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
  paymentStatus: "disbursement_pending" | "due" | "due_today" | "overdue" | "paid";
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
              sanctioned_amount,
              net_disbursement_amount
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
          .in("current_stage", ["approved", "disbursement", "disbursed", "closed"])
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        data = data.concat(batch || []);
        hasMore = (batch?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      const today = new Date();
      // Use local date (not UTC) so IST comparisons are correct
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      let loans: LoanListItem[] = (data || [])
        .map((app: any) => {
          const applicant = Array.isArray(app.loan_applicants) ? app.loan_applicants[0] : app.loan_applicants;
          const sanction = Array.isArray(app.loan_sanctions) ? app.loan_sanctions[0] : app.loan_sanctions;
          const disbursements = Array.isArray(app.loan_disbursements) ? app.loan_disbursements : (app.loan_disbursements ? [app.loan_disbursements] : []);
          const firstDisbursement = disbursements[0];
          const totalDisbursedFromRecords = disbursements.reduce((sum: number, d: any) => sum + (d.disbursement_amount || 0), 0);
          // Fall back to sanction net_disbursement_amount when no disbursement records exist
          const totalDisbursedAmount = totalDisbursedFromRecords > 0
            ? totalDisbursedFromRecords
            : (sanction?.net_disbursement_amount || sanction?.sanctioned_amount || 0);

          // Get repayment schedule data for accurate outstanding calculation
          const schedules = Array.isArray(app.loan_repayment_schedule) ? app.loan_repayment_schedule : (app.loan_repayment_schedule ? [app.loan_repayment_schedule] : []);
          const totalExpected = schedules.reduce((sum: number, s: any) => sum + (s.total_emi || 0), 0);
          const totalPaid = schedules.reduce((sum: number, s: any) => sum + (s.amount_paid || 0), 0);

          const fullName = [
            applicant?.first_name,
            applicant?.middle_name,
            applicant?.last_name,
          ].filter(Boolean).join(" ");

          // Maturity date: disbursement_date + tenure_days (fallback for loans without schedule)
          let maturityDate: string | null = null;
          if (firstDisbursement?.disbursement_date && app.tenure_days) {
            const d = new Date(firstDisbursement.disbursement_date);
            d.setDate(d.getDate() + app.tenure_days);
            maturityDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }

          const isClosed = app.current_stage === 'closed';

          // Outstanding = total expected repayment minus what's been paid
          // Fall back to disbursed amount if no schedule exists yet
          const outstandingAmount = isClosed ? 0
            : schedules.length > 0 ? Math.max(0, totalExpected - totalPaid)
            : totalDisbursedAmount;

          const isPendingDisbursement = ['approved', 'disbursement'].includes(app.current_stage);

          // Unpaid EMIs sorted by due date — use date substring for clean comparison
          const unpaidSchedules = schedules
            .filter((s: any) => s.status !== 'paid' && s.status !== 'settled')
            .map((s: any) => ({ ...s, due_date_str: (s.due_date || '').substring(0, 10) }));

          const hasOverdueEMIs = !isClosed && unpaidSchedules.some((s: any) => s.due_date_str < todayStr);
          const hasDueToday = !isClosed && unpaidSchedules.some((s: any) => s.due_date_str === todayStr);

          // Due date: show earliest overdue EMI date, or next upcoming EMI date, or maturity
          let dueDate: string | null = null;
          if (unpaidSchedules.length > 0) {
            const overdue = unpaidSchedules.filter((s: any) => s.due_date_str < todayStr);
            if (overdue.length > 0) {
              dueDate = overdue.sort((a: any, b: any) => a.due_date_str.localeCompare(b.due_date_str))[0].due_date_str;
            } else {
              const upcoming = unpaidSchedules.filter((s: any) => s.due_date_str >= todayStr);
              if (upcoming.length > 0) {
                dueDate = upcoming.sort((a: any, b: any) => a.due_date_str.localeCompare(b.due_date_str))[0].due_date_str;
              }
            }
          }
          if (!dueDate) dueDate = maturityDate;

          let daysOverdue = 0;
          if (!isClosed && hasOverdueEMIs && dueDate) {
            const diff = Math.floor((today.getTime() - new Date(dueDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
            if (diff > 0) daysOverdue = diff;
          }

          let paymentStatus: "disbursement_pending" | "due" | "due_today" | "overdue" | "paid" = "due";
          if (isPendingDisbursement) {
            paymentStatus = "disbursement_pending";
          } else if (isClosed || (schedules.length > 0 && schedules.every((s: any) => s.status === 'paid' || s.status === 'settled'))) {
            paymentStatus = "paid";
          } else if (hasOverdueEMIs) {
            paymentStatus = "overdue";
          } else if (hasDueToday) {
            paymentStatus = "due_today";
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
