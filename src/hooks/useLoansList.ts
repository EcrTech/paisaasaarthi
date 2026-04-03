import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";

export interface LoanListItem {
  id: string;
  contactId: string | null;
  applicationId: string;
  applicationNumber: string;
  loanId: string;
  disbursedAmount: number;
  sanctionedAmount: number;
  disbursementDate: string | null;
  tenureDays: number;
  dueDate: string | null;
  daysOverdue: number;
  applicantName: string;
  panNumber: string;
  mobile: string;
  email: string | null;
  outstandingAmount: number;
  paymentStatus: "on_track" | "overdue" | "completed";
}

export function useLoansList(searchTerm?: string) {
  const { orgId } = useOrgContext();

  return useQuery({
    queryKey: ["loans-list", orgId, searchTerm],
    queryFn: async (): Promise<LoanListItem[]> => {
      if (!orgId) return [];

      const PAGE_SIZE = 1000;
      let data: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from("loan_applications")
          .select(`
            id,
            contact_id,
            loan_id,
            application_number,
            current_stage,
            tenure_days,
            loan_applicants (
              first_name,
              middle_name,
              last_name,
              pan_number,
              mobile,
              email,
              applicant_type
            ),
            loan_sanctions (
              sanctioned_amount
            ),
            loan_disbursements (
              disbursement_amount,
              disbursement_date
            ),
            loan_repayment_schedule (
              total_emi,
              amount_paid,
              status,
              due_date
            )
          `)
          .eq("org_id", orgId)
          .eq("loan_applicants.applicant_type", "primary")
          .not("loan_id", "is", null)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        data = data.concat(batch || []);
        hasMore = (batch?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      const today = new Date();

      let loans: LoanListItem[] = (data || [])
        .filter((app: any) => ['disbursed', 'closed'].includes(app.current_stage))
        .map((app: any) => {
          const applicant = Array.isArray(app.loan_applicants) ? app.loan_applicants[0] : app.loan_applicants;
          const sanction = Array.isArray(app.loan_sanctions) ? app.loan_sanctions[0] : app.loan_sanctions;
          const disbursements = Array.isArray(app.loan_disbursements) ? app.loan_disbursements : (app.loan_disbursements ? [app.loan_disbursements] : []);
          const firstDisbursement = disbursements[0];
          const totalDisbursedAmount = disbursements.reduce((sum: number, d: any) => sum + (d.disbursement_amount || 0), 0);

          // Get repayment schedule data for accurate outstanding calculation
          const schedules = Array.isArray(app.loan_repayment_schedule) ? app.loan_repayment_schedule : (app.loan_repayment_schedule ? [app.loan_repayment_schedule] : []);
          const totalExpected = schedules.reduce((sum: number, s: any) => sum + (s.total_emi || 0), 0);
          const totalPaid = schedules.reduce((sum: number, s: any) => sum + (s.amount_paid || 0), 0);

          const fullName = [
            applicant?.first_name,
            applicant?.middle_name,
            applicant?.last_name,
          ].filter(Boolean).join(" ");

          // Bullet payment: due date = disbursement_date + tenure_days
          let dueDate: string | null = null;
          if (firstDisbursement?.disbursement_date && app.tenure_days) {
            const d = new Date(firstDisbursement.disbursement_date);
            d.setDate(d.getDate() + app.tenure_days);
            dueDate = d.toISOString().split('T')[0];
          }

          const isClosed = app.current_stage === 'closed';

          // Outstanding = total expected repayment minus what's been paid
          // Fall back to disbursed amount if no schedule exists yet
          const outstandingAmount = isClosed ? 0
            : schedules.length > 0 ? Math.max(0, totalExpected - totalPaid)
            : totalDisbursedAmount;

          // Overdue = has any past-due EMIs that aren't fully paid
          const todayStr = today.toISOString().split('T')[0];
          const hasOverdueEMIs = !isClosed && schedules.some((s: any) =>
            s.due_date < todayStr && s.status !== 'paid' && s.status !== 'settled'
          );

          let daysOverdue = 0;
          if (!isClosed && dueDate) {
            const diff = Math.floor((today.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
            if (diff > 0) daysOverdue = diff;
          }

          let paymentStatus: "on_track" | "overdue" | "completed" = "on_track";
          if (isClosed || (schedules.length > 0 && schedules.every((s: any) => s.status === 'paid' || s.status === 'settled'))) {
            paymentStatus = "completed";
          } else if (hasOverdueEMIs || daysOverdue > 0) {
            paymentStatus = "overdue";
          }

          return {
            id: app.id,
            contactId: app.contact_id || null,
            applicationId: app.id,
            applicationNumber: app.application_number,
            loanId: app.loan_id,
            disbursedAmount: totalDisbursedAmount,
            sanctionedAmount: sanction?.sanctioned_amount || 0,
            disbursementDate: firstDisbursement?.disbursement_date || null,
            tenureDays: app.tenure_days,
            dueDate,
            daysOverdue,
            applicantName: fullName,
            panNumber: applicant?.pan_number || "N/A",
            mobile: applicant?.mobile || "N/A",
            email: applicant?.email || null,
            outstandingAmount,
            paymentStatus,
          };
        });

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        loans = loans.filter((loan) =>
          loan.loanId?.toLowerCase().includes(search) ||
          loan.applicationNumber?.toLowerCase().includes(search) ||
          loan.applicantName?.toLowerCase().includes(search) ||
          loan.panNumber?.toLowerCase().includes(search) ||
          loan.mobile?.includes(search)
        );
      }

      return loans;
    },
    enabled: !!orgId,
  });
}
