import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";

export interface ApplicationListItem {
  id: string;
  contactId: string | null;
  applicationNumber: string;
  loanId: string | null;
  status: string;
  currentStage: string;
  requestedAmount: number;
  approvedAmount: number | null;
  sanctionedAmount: number | null;
  disbursedAmount: number | null;
  tenureDays: number;
  createdAt: string;
  sanctionDate: string | null;
  disbursementDate: string | null;
  applicantName: string;
  panNumber: string;
  mobile: string;
  email: string | null;
  isApproved: boolean;
  isSanctioned: boolean;
  isDisbursed: boolean;
}

export function useApplicationsList(searchTerm?: string) {
  const { orgId } = useOrgContext();

  return useQuery({
    queryKey: ["applications-list", orgId, searchTerm],
    queryFn: async (): Promise<ApplicationListItem[]> => {
      if (!orgId) return [];

      // Fetch all applications in batches (PostgREST default limit is 1000)
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
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
            status,
            current_stage,
            requested_amount,
            approved_amount,
            tenure_days,
            created_at,
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
            )
          `)
          .eq("org_id", orgId)
          .eq("loan_applicants.applicant_type", "primary")
          .neq("status", "draft")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        allData = allData.concat(batch || []);
        hasMore = (batch?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      const data = allData;

      let applications: ApplicationListItem[] = (data || []).map((app: any) => {
        const applicant = app.loan_applicants?.[0];
        const sanction = app.loan_sanctions?.[0];
        const disbursement = app.loan_disbursements?.[0];

        const fullName = [
          applicant?.first_name,
          applicant?.middle_name,
          applicant?.last_name,
        ]
          .filter(Boolean)
          .join(" ");

        return {
          id: app.id,
          contactId: app.contact_id || null,
          applicationNumber: app.application_number,
          loanId: app.loan_id,
          status: app.status,
          currentStage: app.current_stage,
          requestedAmount: app.requested_amount,
          approvedAmount: app.approved_amount,
          sanctionedAmount: sanction?.sanctioned_amount || null,
          disbursedAmount: disbursement?.disbursement_amount || null,
          tenureDays: app.tenure_days,
          createdAt: app.created_at,
          sanctionDate: sanction?.created_at || null,
          disbursementDate: disbursement?.disbursement_date || null,
          applicantName: fullName,
          panNumber: applicant?.pan_number || "N/A",
          mobile: applicant?.mobile || "N/A",
          email: applicant?.email || null,
          isApproved: !!app.approved_amount || ["approved", "sanctioned", "disbursed"].includes(app.current_stage),
          isSanctioned: !!sanction || ["sanctioned", "disbursed"].includes(app.current_stage),
          isDisbursed: !!disbursement || app.current_stage === "disbursed",
        };
      });

      // Filter by search term if provided
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        applications = applications.filter((app) => {
          return (
            app.applicationNumber?.toLowerCase().includes(search) ||
            app.loanId?.toLowerCase().includes(search) ||
            app.applicantName?.toLowerCase().includes(search) ||
            app.panNumber?.toLowerCase().includes(search) ||
            app.mobile?.includes(search)
          );
        });
      }

      return applications;
    },
    enabled: !!orgId,
  });
}
