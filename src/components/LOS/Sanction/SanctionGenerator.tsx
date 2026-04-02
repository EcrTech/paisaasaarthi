import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText } from "lucide-react";

interface SanctionGeneratorProps {
  applicationId: string;
  orgId: string;
}

export default function SanctionGenerator({ applicationId, orgId }: SanctionGeneratorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*, loan_applicants(*)")
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingSanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      return data;
    },
  });

  const generateSanctionMutation = useMutation({
    mutationFn: async () => {
      if (!application?.approved_amount) {
        throw new Error("No approved amount found in loan application");
      }

      const sanctionNumber = `SL${Date.now()}`;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);

      const approvedAmount = application.approved_amount;
      const tenureDays = application.tenure_days || 0;
      const rate = application.interest_rate || 0;

      const processingFee = Math.round(approvedAmount * 0.10);
      const gstOnPf = Math.round(processingFee * 0.18);
      const netDisbursement = approvedAmount - processingFee - gstOnPf;

      const { error } = await supabase.from("loan_sanctions").insert([{
        loan_application_id: applicationId,
        sanction_number: sanctionNumber,
        sanction_date: new Date().toISOString(),
        sanctioned_amount: approvedAmount,
        sanctioned_rate: rate,
        sanctioned_tenure_days: tenureDays,
        processing_fee: processingFee,
        net_disbursement_amount: netDisbursement,
        conditions: {},
        validity_date: validUntil.toISOString(),
        status: "active",
      }]);

      if (error) throw error;

      const { data: transitioned, error: stageError } = await supabase
        .rpc("transition_loan_stage", {
          p_application_id: applicationId,
          p_expected_current_stage: "approved",
          p_new_stage: "disbursement",
        });
      
      if (stageError) throw stageError;
      if (!transitioned) throw new Error("Application stage has changed. Please refresh.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-sanction", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      toast({ title: "Sanction letter generated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isSanctioned = !!existingSanction;
  const canSanction = application?.approved_amount && application.status === "approved";

  return (
    <Button
      onClick={() => generateSanctionMutation.mutate()}
      disabled={isSanctioned || !canSanction || generateSanctionMutation.isPending}
      variant={isSanctioned ? "outline" : "default"}
      className="gap-2"
    >
      <FileText className="h-4 w-4" />
      {generateSanctionMutation.isPending 
        ? "Processing..." 
        : isSanctioned 
          ? "Sanctioned" 
          : "Sanction"}
    </Button>
  );
}
