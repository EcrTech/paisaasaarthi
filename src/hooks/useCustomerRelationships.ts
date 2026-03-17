import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";

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
  delayedPayments: number;
  maxDaysDelayed: number;
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

      const { data: applicants, error } = await supabase
        .from("loan_applicants")
        .select(`
          pan_number,
          mobile,
          first_name,
          middle_name,
          last_name,
          email,
          aadhaar_number,
          loan_application_id,
          loan_applications!inner (
            id,
            loan_id,
            application_number,
            status,
            current_stage,
            requested_amount,
            approved_amount,
            tenure_days,
            created_at,
            loan_sanctions ( sanctioned_amount ),
            loan_disbursements ( disbursement_amount, disbursement_date ),
            loan_repayment_schedule ( total_emi, due_date, status, amount_paid )
          )
        `)
        .eq("loan_applications.org_id", orgId)
        .eq("applicant_type", "primary");

      if (error) throw error;

      // Group by PAN or mobile
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

      (applicants || []).forEach((row: any) => {
        const key = row.pan_number || row.mobile;
        if (!key) return;

        if (!customerMap.has(key)) {
          customerMap.set(key, {
            pan_number: row.pan_number,
            mobile: row.mobile,
            first_name: row.first_name,
            middle_name: row.middle_name,
            last_name: row.last_name,
            email: row.email,
            aadhaar_number: row.aadhaar_number,
            apps: [],
          });
        }

        const app = Array.isArray(row.loan_applications)
          ? row.loan_applications[0]
          : row.loan_applications;

        if (app) {
          const entry = customerMap.get(key)!;
          if (!entry.apps.some((a: any) => a.id === app.id)) {
            entry.apps.push(app);
          }
        }
      });

      // Filter: only customers with at least one disbursed/closed loan
      let customers = Array.from(customerMap.entries()).filter(([_, c]) =>
        c.apps.some((a: any) => ['disbursed', 'closed'].includes(a.current_stage))
      );

      // Search filter
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

      const today = new Date();

      // Build results
      return customers.map(([_, c]) => {
        const fullName = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');

        const sortedApps = [...c.apps].sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        let totalDisbursed = 0;
        let totalEmiAmount = 0;
        let totalAmountPaid = 0;
        let delayedPayments = 0;
        let maxDaysDelayed = 0;

        const appSummaries: LoanApplicationSummary[] = sortedApps.map((app: any) => {
          // PostgREST returns objects (not arrays) for 1-to-1 FK relationships
          const rawDisb = app.loan_disbursements;
          const disbursements = Array.isArray(rawDisb) ? rawDisb : rawDisb ? [rawDisb] : [];
          const totalDisb = disbursements.reduce((sum: number, d: any) => sum + (d.disbursement_amount || 0), 0);
          const rawSanction = app.loan_sanctions;
          const sanction = Array.isArray(rawSanction) ? rawSanction[0] : rawSanction;
          const rawEmis = app.loan_repayment_schedule;
          const emis = Array.isArray(rawEmis) ? rawEmis : rawEmis ? [rawEmis] : [];

          totalDisbursed += totalDisb;
          totalEmiAmount += emis.reduce((sum: number, e: any) => sum + (e.total_emi || 0), 0);
          totalAmountPaid += emis.reduce((sum: number, e: any) => sum + (e.amount_paid || 0), 0);

          // Count delayed/overdue EMIs and max days
          emis.forEach((emi: any) => {
            if (emi.status === 'overdue' || (emi.status === 'pending' && new Date(emi.due_date) < today)) {
              delayedPayments++;
              const daysLate = Math.floor((today.getTime() - new Date(emi.due_date).getTime()) / (1000 * 60 * 60 * 24));
              if (daysLate > maxDaysDelayed) maxDaysDelayed = daysLate;
            }
          });

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
            disbursementDate: disbursements[0]?.disbursement_date || null,
          };
        });

        const outstandingAmount = Math.max(0, totalEmiAmount - totalAmountPaid);
        const totalLoans = appSummaries.filter(a =>
          ['disbursed', 'closed'].includes(a.currentStage)
        ).length;

        return {
          customerId: c.pan_number || c.mobile,
          name: fullName,
          mobile: c.mobile || 'N/A',
          email: c.email,
          panNumber: c.pan_number || 'N/A',
          aadhaarNumber: maskAadhaar(c.aadhaar_number),
          totalApplications: appSummaries.length,
          totalLoans,
          disbursedAmount: totalDisbursed,
          outstandingAmount,
          delayedPayments,
          maxDaysDelayed: Math.max(0, maxDaysDelayed),
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
