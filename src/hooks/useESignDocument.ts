import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ESignRequestParams {
  orgId: string;
  applicationId: string;
  documentId: string;
  documentType: "sanction_letter" | "loan_agreement" | "daily_schedule" | "combined_loan_pack";
  signerName: string;
  signerEmail?: string;
  signerMobile: string;
  appearance?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  environment: "uat" | "production";
}

interface ESignStatusParams {
  orgId: string;
  esignRequestId?: string;
  nupayDocumentId?: string;
  environment: "uat" | "production";
}

interface ESignRequestResponse {
  success: boolean;
  esign_request_id: string;
  signer_url: string;
  nupay_document_id: string;
  ref_no: string;
  expires_at: string;
  error?: string;
}

interface ESignStatusResponse {
  success: boolean;
  status: "pending" | "sent" | "viewed" | "signed" | "expired" | "failed";
  nupay_status?: string;
  signed_at?: string;
  esign_request_id: string;
  signer_url?: string;
  viewed_at?: string;
  error?: string;
}

export function useESignRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ESignRequestParams): Promise<ESignRequestResponse> => {
      // Refresh session to prevent 401 errors on long-open pages
      const { error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError) {
        throw new Error("Session expired. Please log in again.");
      }

      const { data, error } = await supabase.functions.invoke("nupay-esign-request", {
        body: {
          org_id: params.orgId,
          application_id: params.applicationId,
          document_id: params.documentId,
          document_type: params.documentType,
          signer_name: params.signerName,
          signer_email: params.signerEmail,
          signer_mobile: params.signerMobile,
          appearance: params.appearance || "bottom-right",
          environment: params.environment,
        },
      });

      if (error) {
        const contextError = error.context?.error || error.context?.message;
        throw new Error(contextError || error.message);
      }

      if (!data.success) {
        throw new Error(data.error || "E-Sign request failed");
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success("E-Sign request sent successfully");
      queryClient.invalidateQueries({ queryKey: ["esign-requests"] });
      queryClient.invalidateQueries({ queryKey: ["generated-documents"] });
    },
    onError: (error: Error) => {
      toast.error(`E-Sign failed: ${error.message}`);
    },
  });
}

export function useESignStatus(params: ESignStatusParams | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["esign-status", params?.esignRequestId || params?.nupayDocumentId],
    queryFn: async (): Promise<ESignStatusResponse> => {
      if (!params) {
        throw new Error("No params provided");
      }

      const { data, error } = await supabase.functions.invoke("nupay-esign-status", {
        body: {
          org_id: params.orgId,
          esign_request_id: params.esignRequestId,
          nupay_document_id: params.nupayDocumentId,
          environment: params.environment,
        },
      });

      if (error) {
        const contextError = error.context?.error || error.context?.message;
        throw new Error(contextError || error.message);
      }

      return data;
    },
    enabled: options?.enabled !== false && !!params,
    refetchInterval: (query) => {
      // Poll every 30 seconds if status is pending/sent/viewed
      const status = query.state.data?.status;
      if (status && ["pending", "sent", "viewed"].includes(status)) {
        return 30000;
      }
      return false;
    },
  });
}

export function useCheckESignStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ESignStatusParams): Promise<ESignStatusResponse> => {
      await supabase.auth.refreshSession();

      const { data, error } = await supabase.functions.invoke("nupay-esign-status", {
        body: {
          org_id: params.orgId,
          esign_request_id: params.esignRequestId,
          nupay_document_id: params.nupayDocumentId,
          environment: params.environment,
        },
      });

      if (error) {
        const contextError = error.context?.error || error.context?.message;
        throw new Error(contextError || error.message);
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.status === "signed") {
        toast.success("Document has been signed!");
      } else {
        toast.info(`Document status: ${data.status}`);
      }
      queryClient.invalidateQueries({ queryKey: ["esign-requests"] });
      queryClient.invalidateQueries({ queryKey: ["generated-documents"] });
    },
    onError: (error: Error) => {
      toast.error(`Status check failed: ${error.message}`);
    },
  });
}

export function useESignRequests(applicationId: string) {
  return useQuery({
    queryKey: ["esign-requests", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_esign_requests")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
  });
}
