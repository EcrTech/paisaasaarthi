import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";
import { useToast } from "./use-toast";

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
  utr_number?: string;
}

export function useCollections() {
  const { orgId } = useOrgContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: collections, isLoading } = useQuery({
    queryKey: ["collections", orgId],
    queryFn: async () => {
      // Get all EMI schedules for disbursed loans
      const { data, error } = await supabase
        .from("loan_repayment_schedule")
        .select(`
          id,
          loan_application_id,
          due_date,
          total_emi,
          principal_amount,
          interest_amount,
          amount_paid,
          status,
          loan_applications:loan_application_id(
            application_number,
            loan_id,
            requested_amount,
            interest_rate,
            tenure_days,
            contact_id,
            loan_applicants(first_name, last_name, mobile),
            loan_disbursements(disbursement_date, disbursement_amount)
          ),
          loan_payments(transaction_reference)
        `)
        .eq("org_id", orgId!)
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Transform data for table display
      const records: CollectionRecord[] = (data || []).map((item: any) => {
        const applicant = item.loan_applications?.loan_applicants?.[0];
        const disbursement = item.loan_applications?.loan_disbursements?.[0];
        const payment = item.loan_payments?.[0];
        
        return {
          id: item.id,
          loan_application_id: item.loan_application_id,
          application_number: item.loan_applications?.application_number || "N/A",
          loan_id: item.loan_applications?.loan_id || null,
          applicant_name: applicant 
            ? `${applicant.first_name} ${applicant.last_name || ""}`.trim() 
            : "N/A",
          applicant_phone: applicant?.mobile || "",
          due_date: item.due_date,
          total_emi: item.total_emi,
          principal: item.principal_amount,
          interest: item.interest_amount,
          amount_paid: item.amount_paid || 0,
          status: item.status,
          loan_amount: disbursement?.disbursement_amount || item.loan_applications?.requested_amount || 0,
          disbursement_date: disbursement?.disbursement_date || "",
          interest_rate: item.loan_applications?.interest_rate || 0,
          tenure_days: item.loan_applications?.tenure_days || 0,
          contact_id: item.loan_applications?.contact_id,
          utr_number: payment?.transaction_reference || undefined,
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
      const paymentNumber = `PMT${Date.now()}`;

      // Insert payment record
      const { error: paymentError } = await supabase
        .from("loan_payments")
        .insert({
          loan_application_id: payment.applicationId,
          schedule_id: payment.scheduleId,
          org_id: orgId!,
          payment_number: paymentNumber,
          payment_date: payment.paymentDate,
          payment_amount: payment.paymentAmount,
          principal_paid: payment.principalPaid,
          interest_paid: payment.interestPaid,
          late_fee_paid: payment.lateFeePaid,
          payment_method: payment.paymentMethod,
          transaction_reference: payment.transactionReference,
          notes: payment.notes,
          created_by: user?.user?.id,
        });

      if (paymentError) throw paymentError;

      // Atomic schedule update - prevents race conditions
      const { error: updateError } = await supabase
        .rpc("record_emi_payment_atomic", {
          p_schedule_id: payment.scheduleId,
          p_payment_amount: payment.paymentAmount,
          p_payment_date: payment.paymentDate,
        });

      if (updateError) throw updateError;
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

  return {
    collections: collections || [],
    isLoading,
    recordPayment: recordPaymentMutation.mutate,
    isRecording: recordPaymentMutation.isPending,
  };
}
