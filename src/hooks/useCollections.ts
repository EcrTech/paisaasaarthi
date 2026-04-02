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
      // Fetch all EMI schedules in batches (Supabase caps at 1000 per request)
      const batchSize = 1000;
      let allData: any[] = [];
      let offset = 0;
      while (true) {
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
            loan_payments(id, transaction_reference, payment_amount, payment_date, payment_method)
          `)
          .eq("org_id", orgId!)
          .order("due_date", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        allData = allData.concat(data || []);
        if (!data || data.length < batchSize) break;
        offset += batchSize;
      }

      // Transform data for table display
      const records: CollectionRecord[] = allData.map((item: any) => {
        const applicant = item.loan_applications?.loan_applicants?.[0];
        const disbData = item.loan_applications?.loan_disbursements;
        const disbursement = Array.isArray(disbData) ? disbData[0] : disbData;
        const rawPayments = Array.isArray(item.loan_payments) ? item.loan_payments : [];
        const payments: PaymentRecord[] = rawPayments.map((p: any) => ({
          id: p.id,
          transaction_reference: p.transaction_reference || null,
          payment_amount: p.payment_amount || 0,
          payment_date: p.payment_date || "",
          payment_method: p.payment_method || null,
        }));

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
