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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLOSPermissions } from "@/hooks/useLOSPermissions";

const REJECTION_REASONS = [
  "Customer not interested",
  "Customer need higher Amount",
  "Interest rates are high",
  "High processing fee",
  "Document incomplete",
  "Overdue Case",
  "No due certificate Available",
  "Others",
];

interface RejectApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  currentStage: string;
  orgId: string;
  userId: string;
}

export default function RejectApplicationDialog({
  open,
  onOpenChange,
  applicationId,
  currentStage,
  orgId,
  userId,
}: RejectApplicationDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [comments, setComments] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useLOSPermissions();

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const fullComments = [rejectionReason, comments].filter(Boolean).join(" - ");

      // Create audit trail in loan_approvals
      const { error: approvalError } = await supabase
        .from("loan_approvals")
        .insert({
          loan_application_id: applicationId,
          approver_id: userId,
          approver_role: "caller",
          approval_level: "final",
          approval_status: "rejected",
          comments: fullComments,
        });

      if (approvalError) throw approvalError;

      // Save rejection reason on the application
      await supabase
        .from("loan_applications")
        .update({ rejection_reason: rejectionReason })
        .eq("id", applicationId);

      // Transition stage to rejected
      const { data: transitionResult, error: updateError } = await supabase
        .rpc("transition_loan_stage", {
          p_application_id: applicationId,
          p_expected_current_stage: currentStage,
          p_new_stage: "rejected",
        });

      if (updateError) throw updateError;
      if (!transitionResult) throw new Error("Application stage has changed. Please refresh and try again.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application"] });
      queryClient.invalidateQueries({ queryKey: ["loan-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });

      toast({
        title: "Application Rejected",
        description: "The application has been rejected successfully.",
      });

      onOpenChange(false);
      setRejectionReason("");
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

  if (!permissions.canRejectLoans) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permission Denied</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You don't have permission to reject loan applications.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Reject Application
          </DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting this application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rejectionReason">Rejection Reason *</Label>
            <Select value={rejectionReason} onValueChange={setRejectionReason}>
              <SelectTrigger id="rejectionReason">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rejectComments">Additional Comments (Optional)</Label>
            <Textarea
              id="rejectComments"
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
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending || !rejectionReason}
          >
            {rejectMutation.isPending ? "Processing..." : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
