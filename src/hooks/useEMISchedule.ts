import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";
import { useToast } from "./use-toast";
import { calculateLoanDetails } from "@/utils/loanCalculations";

export interface EMIScheduleItem {
  id: string;
  loan_application_id: string;
  sanction_id: string;
  org_id: string;
  emi_number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_emi: number;
  outstanding_principal: number;
  status: "pending" | "paid" | "overdue" | "partially_paid";
  payment_date?: string;
  amount_paid: number;
  late_fee: number;
  created_at: string;
  updated_at: string;
}

export function useEMISchedule(applicationId?: string) {
  const { orgId } = useOrgContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["emi-schedule", applicationId, orgId],
    queryFn: async () => {
      if (!applicationId) return [];
      
      const { data, error } = await supabase
        .from("loan_repayment_schedule")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("org_id", orgId)
        .order("emi_number", { ascending: true });

      if (error) throw error;
      return data as EMIScheduleItem[];
    },
    enabled: !!applicationId && !!orgId,
  });

  const generateScheduleMutation = useMutation({
    mutationFn: async ({
      applicationId,
      sanctionId,
      loanAmount,
      interestRate,    // Daily interest rate (e.g., 1 for 1%)
      tenureDays,
      disbursementDate,
    }: {
      applicationId: string;
      sanctionId: string;
      loanAmount: number;
      interestRate: number;
      tenureDays: number;
      disbursementDate: string;
    }) => {
      // Bullet payment: single repayment due at maturity (disbursement + tenure)
      const { totalInterest, totalRepayment } = calculateLoanDetails(
        loanAmount,
        interestRate,
        tenureDays
      );

      const dueDate = new Date(disbursementDate);
      dueDate.setDate(dueDate.getDate() + tenureDays);
      const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;

      const { error } = await supabase
        .from("loan_repayment_schedule")
        .insert({
          loan_application_id: applicationId,
          sanction_id: sanctionId,
          org_id: orgId!,
          emi_number: 1,
          due_date: dueDateStr,
          principal_amount: loanAmount,
          interest_amount: Math.round(totalInterest),
          total_emi: Math.round(totalRepayment),
          outstanding_principal: loanAmount,
          status: "pending",
          amount_paid: 0,
          late_fee: 0,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emi-schedule"] });
      toast({ title: "Repayment schedule generated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error generating schedule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOverdueStatusMutation = useMutation({
    mutationFn: async () => {
      const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      const { error } = await supabase
        .from("loan_repayment_schedule")
        .update({ status: "overdue" })
        .eq("org_id", orgId!)
        .eq("status", "pending")
        .lt("due_date", today);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emi-schedule"] });
    },
  });

  return {
    schedule,
    isLoading,
    generateSchedule: generateScheduleMutation.mutate,
    isGenerating: generateScheduleMutation.isPending,
    updateOverdueStatus: updateOverdueStatusMutation.mutate,
  };
}
