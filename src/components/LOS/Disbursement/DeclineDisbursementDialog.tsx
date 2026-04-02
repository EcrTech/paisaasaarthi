import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Ban } from "lucide-react";

const DECLINE_REASONS = [
  "Customer not interested",
  "Bank account details incorrect",
  "Compliance/regulatory hold",
  "Fraud suspicion",
  "Customer requested cancellation",
  "Insufficient documentation",
  "Sanctioned amount mismatch",
  "Others",
];

interface DeclineDisbursementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicantName: string;
}

export default function DeclineDisbursementDialog({
  open,
  onOpenChange,
  applicationId,
  applicantName,
}: DeclineDisbursementDialogProps) {
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const declineMutation = useMutation({
    mutationFn: async () => {
      const fullReason = [reason, comments].filter(Boolean).join(" - ");

      // Store decline reason on the application
      await supabase
        .from("loan_applications")
        .update({ rejection_reason: fullReason })
        .eq("id", applicationId);

      // If a pending disbursement record exists, mark it declined
      await supabase
        .from("loan_disbursements")
        .update({
          status: "declined",
          failure_reason: fullReason,
          updated_at: new Date().toISOString(),
        })
        .eq("loan_application_id", applicationId)
        .eq("status", "pending");

      // Transition stage to rejected (decline = reject from disbursement)
      const { data: transitioned, error } = await supabase.rpc(
        "transition_loan_stage",
        {
          p_application_id: applicationId,
          p_expected_current_stage: "disbursement",
          p_new_stage: "rejected",
        }
      );

      // Also try from approved stage
      if (!transitioned) {
        const { error: err2 } = await supabase.rpc("transition_loan_stage", {
          p_application_id: applicationId,
          p_expected_current_stage: "approved",
          p_new_stage: "rejected",
        });
        if (err2) throw err2;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-disbursals"] });
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });

      toast({
        title: "Disbursement Declined",
        description: `Disbursement for ${applicantName} has been declined.`,
      });

      onOpenChange(false);
      setReason("");
      setComments("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-600" />
            Decline Disbursement
          </DialogTitle>
          <DialogDescription>
            Decline disbursement for <strong>{applicantName}</strong>. This will
            stop the loan from being disbursed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="declineReason">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="declineReason">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {DECLINE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="declineComments">Additional Comments (Optional)</Label>
            <Textarea
              id="declineComments"
              placeholder="Add any additional details..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => declineMutation.mutate()}
            disabled={declineMutation.isPending || !reason}
          >
            {declineMutation.isPending ? "Processing..." : "Decline Disbursement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
