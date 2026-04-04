import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { getTodayIST, calcMaturityDate, getLatestNachDate, calcLoanDueStatus } from "@/utils/loanCalculations";

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
            ),
            nupay_mandates (
              first_collection_date,
              status
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

      let loans: LoanListItem[] = (data || [])
        .map((app: any) => {
          const applicant = Array.isArray(app.loan_applicants) ? app.loan_applicants[0] : app.loan_applicants;
          const sanction = Array.isArray(app.loan_sanctions) ? app.loan_sanctions[0] : app.loan_sanctions;
          const disbursements = Array.isArray(app.loan_disbursements) ? app.loan_disbursements : (app.loan_disbursements ? [app.loan_disbursements] : []);
          const firstDisbursement = disbursements[0];
          const totalDisbursedFromRecords = disbursements.reduce((sum: number, d: any) => sum + (d.disbursement_amount || 0), 0);
          const totalDisbursedAmount = totalDisbursedFromRecords > 0
            ? totalDisbursedFromRecords
            : (sanction?.net_disbursement_amount || sanction?.sanctioned_amount || 0);

          const mandates = Array.isArray(app.nupay_mandates) ? app.nupay_mandates : (app.nupay_mandates ? [app.nupay_mandates] : []);
          const nachCollectionDate = getLatestNachDate(mandates);

          const schedules = Array.isArray(app.loan_repayment_schedule) ? app.loan_repayment_schedule : (app.loan_repayment_schedule ? [app.loan_repayment_schedule] : []);
          const totalExpected = schedules.reduce((sum: number, s: any) => sum + (s.total_emi || 0), 0);
          const totalPaid = schedules.reduce((sum: number, s: any) => sum + (s.amount_paid || 0), 0);

          const fullName = [
            applicant?.first_name,
            applicant?.middle_name,
            applicant?.last_name,
          ].filter(Boolean).join(" ");

          const maturityDate = (firstDisbursement?.disbursement_date && app.tenure_days)
            ? calcMaturityDate(firstDisbursement.disbursement_date, app.tenure_days)
            : null;

          const isClosed = app.current_stage === 'closed';
          const outstandingAmount = isClosed ? 0
            : schedules.length > 0 ? Math.max(0, totalExpected - totalPaid)
            : totalDisbursedAmount;

          const isPendingDisbursement = ['approved', 'disbursement'].includes(app.current_stage);

          const unpaidScheduleDates = schedules
            .filter((s: any) => s.status !== 'paid' && s.status !== 'settled')
            .map((s: any) => (s.due_date || '').substring(0, 10));

          const { dueDate, daysOverdue, hasOverdue, hasDueToday } = calcLoanDueStatus({
            nachCollectionDate,
            unpaidScheduleDates,
            maturityDate,
            isClosed,
            outstandingAmount,
          });

          let paymentStatus: "disbursement_pending" | "due" | "due_today" | "overdue" | "paid" = "due";
          if (isPendingDisbursement) {
            paymentStatus = "disbursement_pending";
          } else if (isClosed || (schedules.length > 0 && schedules.every((s: any) => s.status === 'paid' || s.status === 'settled'))) {
            paymentStatus = "paid";
          } else if (hasOverdue) {
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
