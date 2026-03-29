import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";
import { useToast } from "./use-toast";

export interface EMIPayment {
  id: string;
  loan_application_id: string;
  schedule_id?: string;
  org_id: string;
  payment_number: string;
  payment_date: string;
  payment_amount: number;
  principal_paid: number;
  interest_paid: number;
  late_fee_paid: number;
  payment_method: string;
  transaction_reference?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export function useEMIPayments(applicationId?: string) {
  const { orgId } = useOrgContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["emi-payments", applicationId, orgId],
    queryFn: async () => {
      if (!applicationId) return [];
      
      const { data, error } = await supabase
        .from("loan_payments")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("org_id", orgId)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data as EMIPayment[];
    },
    enabled: !!applicationId && !!orgId,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (payment: {
      scheduleId: string;
      applicationId: string;
      paymentDate: string;
      paymentAmount: number;
      principalPaid: number;
      interestPaid: number;
      lateFeePaid: number;
      paymentMethod: string;
      transactionReference?: string;
      notes?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();

      // Single atomic RPC: inserts loan_payments + updates schedule in one transaction
      const { error } = await supabase.rpc("record_payment", {
        p_schedule_id: payment.scheduleId,
        p_application_id: payment.applicationId,
        p_org_id: orgId!,
        p_payment_date: payment.paymentDate,
        p_payment_amount: payment.paymentAmount,
        p_principal_paid: payment.principalPaid,
        p_interest_paid: payment.interestPaid,
        p_late_fee_paid: payment.lateFeePaid,
        p_payment_method: payment.paymentMethod,
        p_transaction_reference: payment.transactionReference || null,
        p_notes: payment.notes || null,
        p_created_by: user?.user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emi-payments"] });
      queryClient.invalidateQueries({ queryKey: ["emi-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["emi-stats"] });
      toast({ title: "Payment recorded successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error recording payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    payments,
    isLoading,
    recordPayment: recordPaymentMutation.mutate,
    isRecording: recordPaymentMutation.isPending,
  };
}
