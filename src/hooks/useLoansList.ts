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
  disbursementDate: string;
  tenureDays: number;
  applicantName: string;
  panNumber: string;
  mobile: string;
  email: string | null;
  totalEmiAmount: number;
  totalPaid: number;
  outstandingAmount: number;
  emiCount: number;
  paidEmiCount: number;
  overdueEmiCount: number;
  nextDueDate: string | null;
  nextDueAmount: number | null;
  paymentStatus: "on_track" | "overdue" | "completed";
  onTimePaymentPercent: number;
}

export function useLoansList(searchTerm?: string) {
  const { orgId } = useOrgContext();

  return useQuery({
    queryKey: ["loans-list", orgId, searchTerm],
    queryFn: async (): Promise<LoanListItem[]> => {
      if (!orgId) return [];

      // Fetch all disbursed loans with pagination (PostgREST caps at 1000 per request)
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
            loan_applicants!inner (
              first_name,
              middle_name,
              last_name,
              pan_number,
              mobile,
              email,
              applicant_type
            ),
            loan_sanctions (
              id,
              sanctioned_amount,
              created_at
            ),
            loan_disbursements (
              id,
              disbursement_amount,
              disbursement_date
            ),
            loan_repayment_schedule (
              id,
              emi_number,
              total_emi,
              due_date,
              status,
              payment_date,
              amount_paid
            ),
            loan_payments (
              id,
              payment_amount,
              payment_date
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

      let loans: LoanListItem[] = (data || [])
        .filter((app: any) => ['disbursed', 'closed'].includes(app.current_stage))
        .map((app: any) => {
          const applicant = Array.isArray(app.loan_applicants) ? app.loan_applicants[0] : app.loan_applicants;
          const sanction = Array.isArray(app.loan_sanctions) ? app.loan_sanctions[0] : app.loan_sanctions;
          const disbursements = Array.isArray(app.loan_disbursements) ? app.loan_disbursements : (app.loan_disbursements ? [app.loan_disbursements] : []);
          const firstDisbursement = disbursements[0];
          const totalDisbursedAmount = disbursements.reduce((sum: number, d: any) => sum + (d.disbursement_amount || 0), 0);
          const emiSchedule = app.loan_repayment_schedule || [];
          const payments = app.loan_payments || [];

          const fullName = [
            applicant?.first_name,
            applicant?.middle_name,
            applicant?.last_name,
          ]
            .filter(Boolean)
            .join(" ");

          // Calculate EMI stats
          const totalEmiAmount = emiSchedule.reduce(
            (sum: number, emi: any) => sum + (emi.total_emi || 0),
            0
          );
          const paidEmis = emiSchedule.filter((e: any) => e.status === "paid");
          const overdueEmis = emiSchedule.filter((e: any) => e.status === "overdue");
          const pendingEmis = emiSchedule.filter((e: any) => e.status === "pending");

          // Calculate payments
          const totalPaid = payments
            .reduce((sum: number, p: any) => sum + (p.payment_amount || 0), 0);

          const outstandingAmount = Math.max(0, totalEmiAmount - totalPaid);

          // Find next due EMI
          const nextDueEmi = pendingEmis
            .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

          // Calculate on-time payment percentage
          let onTimePaymentPercent = 100;
          if (paidEmis.length > 0) {
            const onTimeCount = paidEmis.filter((e: any) => {
              if (!e.payment_date) return false;
              return new Date(e.payment_date) <= new Date(e.due_date);
            }).length;
            onTimePaymentPercent = Math.round((onTimeCount / paidEmis.length) * 100);
          }

          // Determine payment status
          let paymentStatus: "on_track" | "overdue" | "completed" = "on_track";
          if (outstandingAmount === 0 && paidEmis.length === emiSchedule.length) {
            paymentStatus = "completed";
          } else if (overdueEmis.length > 0) {
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
            disbursementDate: firstDisbursement?.disbursement_date,
            tenureDays: app.tenure_days,
            applicantName: fullName,
            panNumber: applicant?.pan_number || "N/A",
            mobile: applicant?.mobile || "N/A",
            email: applicant?.email || null,
            totalEmiAmount,
            totalPaid,
            outstandingAmount,
            emiCount: emiSchedule.length,
            paidEmiCount: paidEmis.length,
            overdueEmiCount: overdueEmis.length,
            nextDueDate: nextDueEmi?.due_date || null,
            nextDueAmount: nextDueEmi?.total_emi || null,
            paymentStatus,
            onTimePaymentPercent,
          };
        });

      // Filter by search term if provided
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        loans = loans.filter((loan) => {
          return (
            loan.loanId?.toLowerCase().includes(search) ||
            loan.applicationNumber?.toLowerCase().includes(search) ||
            loan.applicantName?.toLowerCase().includes(search) ||
            loan.panNumber?.toLowerCase().includes(search) ||
            loan.mobile?.includes(search)
          );
        });
      }

      return loans;
    },
    enabled: !!orgId,
  });
}
