import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";
import { toast } from "sonner";

export interface UPITransaction {
  id: string;
  org_id: string;
  loan_application_id: string;
  schedule_id: string | null;
  client_reference_id: string;
  transaction_id: string | null;
  request_amount: number;
  transaction_amount: number | null;
  payment_link: string | null;
  payee_vpa: string | null;
  payer_vpa: string | null;
  payer_name: string | null;
  payer_mobile: string | null;
  status: string;
  status_description: string | null;
  utr: string | null;
  expires_at: string | null;
  created_at: string;
}

interface CreateCollectionParams {
  schedule_id?: string;
  loan_application_id: string;
  loan_id?: string;
  emi_number?: number;
  amount: number;
  payer_name: string;
  payer_mobile: string;
  payer_email?: string;
}

export function useUPICollection() {
  const { orgId } = useOrgContext();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch active config to check if collection is enabled
  const { data: collectionConfig } = useQuery({
    queryKey: ["nupay-collection-config", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nupay_config")
        .select("id, environment, collection_enabled, is_active, access_key")
        .eq("org_id", orgId!)
        .eq("is_active", true)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!orgId,
  });

  // Fetch existing transaction for a schedule
  const getExistingTransaction = async (scheduleId: string): Promise<UPITransaction | null> => {
    const { data } = await supabase
      .from("nupay_upi_transactions")
      .select("*")
      .eq("schedule_id", scheduleId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return data as UPITransaction | null;
  };

  // Create UPI collection request
  const createCollectionMutation = useMutation({
    mutationFn: async (params: CreateCollectionParams): Promise<UPITransaction> => {
      if (!orgId) throw new Error("No organization selected");

      setIsGenerating(true);

      // Check for existing valid transaction
      if (params.schedule_id) {
        const existing = await getExistingTransaction(params.schedule_id);
        if (existing) {
          return existing;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("nupay-create-upi-collection", {
        body: {
          org_id: orgId,
          environment: collectionConfig?.environment || "uat",
          ...params,
        },
      });

      if (response.error) throw response.error;
      if (!response.data?.success) {
        throw new Error(response.data?.error || "Failed to create collection request");
      }

      return response.data.transaction;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["upi-transactions"] });
      toast.success("UPI payment request created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create payment request", { description: error.message });
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  // Check transaction status
  const checkStatusMutation = useMutation({
    mutationFn: async (clientReferenceId: string) => {
      const response = await supabase.functions.invoke("nupay-collection-status", {
        body: null,
        headers: {},
      });

      // Use GET with query params
      const { data, error } = await supabase
        .from("nupay_upi_transactions")
        .select("*")
        .eq("client_reference_id", clientReferenceId)
        .single();

      if (error) throw error;

      // If pending, call the status API
      if (data && data.status === "pending") {
        const statusResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/nupay-collection-status?client_reference_id=${clientReferenceId}`,
          {
            headers: {
              "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          }
        );
        const statusData = await statusResponse.json();
        if (statusData.success) {
          return statusData.transaction;
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["upi-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      
      if (data?.status === "SUCCESS") {
        toast.success("Payment received!", { description: `UTR: ${data.utr}` });
      } else if (data?.status === "FAILED" || data?.status === "REJECTED") {
        toast.error("Payment failed", { description: data.status_description });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to check status", { description: error.message });
    },
  });

  // Fetch transactions for a loan application
  const useTransactions = (loanApplicationId: string) => {
    return useQuery({
      queryKey: ["upi-transactions", loanApplicationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("nupay_upi_transactions")
          .select("*")
          .eq("loan_application_id", loanApplicationId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data as UPITransaction[];
      },
      enabled: !!loanApplicationId,
    });
  };

  return {
    isCollectionEnabled: !!collectionConfig?.collection_enabled && !!collectionConfig?.access_key,
    collectionConfig,
    createCollection: createCollectionMutation.mutateAsync,
    isCreating: createCollectionMutation.isPending || isGenerating,
    checkStatus: checkStatusMutation.mutateAsync,
    isCheckingStatus: checkStatusMutation.isPending,
    useTransactions,
    getExistingTransaction,
  };
}
