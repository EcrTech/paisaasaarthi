import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { calcMaturityDate, getLatestNachDate, calcLoanDueStatus, calcDaysOverdue } from "@/utils/loanCalculations";

export interface LoanApplicationSummary {
  applicationId: string;
  loanId: string | null;
  applicationNumber: string;
  status: string;
  currentStage: string;
  requestedAmount: number;
  approvedAmount: number | null;
  disbursedAmount: number | null;
  tenureDays: number;
  createdAt: string;
  disbursementDate: string | null;
  dueDate: string | null;
  daysOverdue: number;
}

export interface CustomerRelationship {
  customerId: string;
  name: string;
  mobile: string;
  email: string | null;
  panNumber: string;
  aadhaarNumber: string;
  totalApplications: number;
  totalLoans: number;
  disbursedAmount: number;
  outstandingAmount: number;
  overdueLoans: number;
  maxDaysOverdue: number;
  lastActivityDate: string;
  applications: LoanApplicationSummary[];
}

function maskAadhaar(aadhaar: string | null): string {
  if (!aadhaar) return 'N/A';
  return 'XXXX-XXXX-' + aadhaar.slice(-4);
}

export function useCustomerRelationships(searchTerm?: string) {
  const { orgId } = useOrgContext();

  return useQuery({
    queryKey: ["customer-relationships", orgId, searchTerm],
    queryFn: async (): Promise<CustomerRelationship[]> => {
      if (!orgId) return [];

      const PAGE_SIZE = 1000;
      let allApps: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from("loan_applications")
          .select(`
            id,
            loan_id,
            application_number,
            status,
            current_stage,
            requested_amount,
            approved_amount,
            tenure_days,
            created_at,
            loan_applicants (
              first_name,
              middle_name,
              last_name,
              pan_number,
              mobile,
              email,
              aadhaar_number,
              applicant_type
            ),
            loan_sanctions ( sanctioned_amount, net_disbursement_amount ),
            loan_disbursements ( disbursement_amount, disbursement_date ),
            loan_repayment_schedule ( total_emi, amount_paid, status, due_date ),
            nupay_mandates ( first_collection_date, status )
          `)
          .eq("org_id", orgId)
          .eq("loan_applicants.applicant_type", "primary")
          .in("current_stage", ["approved", "disbursement", "disbursed", "closed"])
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        allApps = allApps.concat(batch || []);
        hasMore = (batch?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      // Group by PAN (fallback to mobile) to deduplicate customers
      const customerMap = new Map<string, {
        pan_number: string;
        mobile: string;
        first_name: string;
        middle_name: string | null;
        last_name: string | null;
        email: string | null;
        aadhaar_number: string | null;
        apps: any[];
      }>();

      for (const app of allApps) {
        const applicant = Array.isArray(app.loan_applicants)
          ? app.loan_applicants[0]
          : app.loan_applicants;
        if (!applicant) continue;

        const key = applicant.pan_number || applicant.mobile;
        if (!key) continue;

        if (!customerMap.has(key)) {
          customerMap.set(key, {
            pan_number: applicant.pan_number,
            mobile: applicant.mobile,
            first_name: applicant.first_name,
            middle_name: applicant.middle_name,
            last_name: applicant.last_name,
            email: applicant.email,
            aadhaar_number: applicant.aadhaar_number,
            apps: [],
          });
        }

        const entry = customerMap.get(key)!;
        if (!entry.apps.some((a: any) => a.id === app.id)) {
          entry.apps.push(app);
        }
      }

      // Search filter
      let customers = Array.from(customerMap.entries());
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        customers = customers.filter(([_, c]) => {
          const name = `${c.first_name} ${c.middle_name || ''} ${c.last_name || ''}`.toLowerCase();
          return (
            c.pan_number?.toLowerCase().includes(s) ||
            c.mobile?.includes(s) ||
            name.includes(s)
          );
        });
      }

      // Build results
      return customers.map(([_, c]) => {
        const fullName = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');

        const sortedApps = [...c.apps].sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        let totalDisbursed = 0;
        let outstandingAmount = 0;
        let overdueLoans = 0;
        let maxDaysOverdue = 0;

        const appSummaries: LoanApplicationSummary[] = sortedApps.map((app: any) => {
          const rawDisb = app.loan_disbursements;
          const disbursements = Array.isArray(rawDisb) ? rawDisb : rawDisb ? [rawDisb] : [];
          const totalDisbFromRecords = disbursements.reduce((sum: number, d: any) => sum + (d.disbursement_amount || 0), 0);

          const rawSanction = app.loan_sanctions;
          const sanction = Array.isArray(rawSanction) ? rawSanction[0] : rawSanction;

          const totalDisb = totalDisbFromRecords > 0
            ? totalDisbFromRecords
            : (sanction?.net_disbursement_amount || sanction?.sanctioned_amount || 0);

          totalDisbursed += totalDisb;

          const rawSchedules = app.loan_repayment_schedule;
          const schedules = Array.isArray(rawSchedules) ? rawSchedules : rawSchedules ? [rawSchedules] : [];
          const totalExpected = schedules.reduce((sum: number, s: any) => sum + (s.total_emi || 0), 0);
          const totalPaid = schedules.reduce((sum: number, s: any) => sum + (s.amount_paid || 0), 0);

          const mandates = Array.isArray(app.nupay_mandates) ? app.nupay_mandates : (app.nupay_mandates ? [app.nupay_mandates] : []);
          const nachCollectionDate = getLatestNachDate(mandates);

          const firstDisbDate = disbursements[0]?.disbursement_date;
          const maturityDate = (firstDisbDate && app.tenure_days)
            ? calcMaturityDate(firstDisbDate, app.tenure_days)
            : null;

          const isClosed = app.current_stage === 'closed';
          const allPaid = schedules.length > 0 && schedules.every((s: any) => s.status === 'paid' || s.status === 'settled');

          const appOutstanding = isClosed || allPaid ? 0
            : schedules.length > 0 ? Math.max(0, totalExpected - totalPaid)
            : totalDisb;
          outstandingAmount += appOutstanding;

          const unpaidScheduleDates = schedules
            .filter((s: any) => s.status !== 'paid' && s.status !== 'settled')
            .map((s: any) => (s.due_date || '').substring(0, 10));

          // Use NACH date as due date, fall back to maturity
          const dueDate: string | null = nachCollectionDate || maturityDate;

          const { hasOverdue, daysOverdue: dueDaysOverdue } = calcLoanDueStatus({
            nachCollectionDate,
            unpaidScheduleDates,
            maturityDate,
            isClosed: isClosed || allPaid,
            outstandingAmount: appOutstanding,
          });

          const daysOverdue = hasOverdue && dueDate ? calcDaysOverdue(dueDate) : 0;

          if (hasOverdue) {
            overdueLoans++;
            if (daysOverdue > maxDaysOverdue) maxDaysOverdue = daysOverdue;
          }

          return {
            applicationId: app.id,
            loanId: app.loan_id,
            applicationNumber: app.application_number,
            status: app.status,
            currentStage: app.current_stage,
            requestedAmount: app.requested_amount,
            approvedAmount: app.approved_amount || sanction?.sanctioned_amount || null,
            disbursedAmount: totalDisb || null,
            tenureDays: app.tenure_days,
            createdAt: app.created_at,
            disbursementDate: firstDisbDate || null,
            dueDate,
            daysOverdue,
          };
        });

        return {
          customerId: c.pan_number || c.mobile,
          name: fullName,
          mobile: c.mobile || 'N/A',
          email: c.email,
          panNumber: c.pan_number || 'N/A',
          aadhaarNumber: maskAadhaar(c.aadhaar_number),
          totalApplications: appSummaries.length,
          totalLoans: appSummaries.length,
          disbursedAmount: totalDisbursed,
          outstandingAmount,
          overdueLoans,
          maxDaysOverdue: Math.max(0, maxDaysOverdue),
          lastActivityDate: sortedApps[0]?.created_at || '',
          applications: appSummaries,
        };
      }).sort((a, b) =>
        new Date(b.lastActivityDate).getTime() - new Date(a.lastActivityDate).getTime()
      );
    },
    enabled: !!orgId,
  });
}
