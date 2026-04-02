import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";
import { useToast } from "./use-toast";

export interface PaymentRecord {
  id: string;
  transaction_reference: string | null;
  payment_amount: number;
  payment_date: string;
  payment_method: string | null;
}

export interface CollectionRecord {
  id: string;
  loan_application_id: string;
  application_number: string;
  loan_id: string | null;
  applicant_name: string;
  applicant_phone: string;
  due_date: string;
  total_emi: number;
  principal: number;
  interest: number;
  amount_paid: number;
  status: string;
  loan_amount: number;
  disbursement_date: string;
  interest_rate: number;
  tenure_days: number;
  contact_id?: string;
  payments: PaymentRecord[];
}

export function useCollections() {
  const { orgId } = useOrgContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: collections, isLoading } = useQuery({
    queryKey: ["collections", orgId],
    queryFn: async () => {
      // Fetch next due EMI per loan using RPC (one row per loan)
      const { data, error } = await supabase.rpc("get_collection_records", {
        p_org_id: orgId!,
      });

      if (error) throw error;

      // Transform data for table display
      const records: CollectionRecord[] = (data || []).map((item: any) => {
        const rawPayments = Array.isArray(item.payments) ? item.payments : [];
        const payments: PaymentRecord[] = rawPayments.map((p: any) => ({
          id: p.id,
          transaction_reference: p.transaction_reference || null,
          payment_amount: p.payment_amount || 0,
          payment_date: p.payment_date || "",
          payment_method: p.payment_method || null,
        }));

        return {
          id: item.schedule_id,
          loan_application_id: item.loan_application_id,
          application_number: item.application_number || "N/A",
          loan_id: item.loan_id || null,
          applicant_name: item.applicant_name || "N/A",
          applicant_phone: item.applicant_phone || "",
          due_date: item.due_date,
          total_emi: item.total_emi,
          principal: item.principal_amount,
          interest: item.interest_amount,
          amount_paid: item.amount_paid || 0,
          status: item.status,
          loan_amount: item.loan_amount || 0,
          disbursement_date: item.disbursement_date || "",
          interest_rate: item.interest_rate || 0,
          tenure_days: item.tenure_days || 0,
          contact_id: item.contact_id,
          payments,
        };
      });

      return records;
    },
    enabled: !!orgId,
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
      queryClient.invalidateQueries({ queryKey: ["collections"] });
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

  const settleLoanMutation = useMutation({
    mutationFn: async (params: {
      scheduleId: string;
      settlementAmount: number;
      settlementDate: string;
      notes?: string;
    }) => {
      // Update schedule to settled status
      const { error } = await supabase
        .from("loan_repayment_schedule")
        .update({
          status: "settled",
          amount_paid: params.settlementAmount,
          payment_date: params.settlementDate,
        })
        .eq("id", params.scheduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["emi-stats"] });
      toast({ title: "Loan settled successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error settling loan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    collections: collections || [],
    isLoading,
    recordPayment: recordPaymentMutation.mutate,
    isRecording: recordPaymentMutation.isPending,
    settleLoan: settleLoanMutation.mutate,
    isSettling: settleLoanMutation.isPending,
  };
}
