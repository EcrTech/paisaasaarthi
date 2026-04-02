import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

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

interface ApprovalActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  action: "approve" | "reject";
  orgId: string;
  userId: string;
}

export default function ApprovalActionDialog({
  open,
  onOpenChange,
  applicationId,
  action,
  orgId,
  userId,
}: ApprovalActionDialogProps) {
  const [comments, setComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useLOSPermissions();

  // Fetch eligibility data - this is the source of truth for approved amount
  const { data: eligibility, isLoading: eligibilityLoading } = useQuery({
    queryKey: ["loan-eligibility", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_eligibility")
        .select("eligible_loan_amount, recommended_tenure_days, recommended_interest_rate")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && action === "approve",
  });

  // Pre-fill custom amount when eligibility loads
  useEffect(() => {
    if (eligibility?.eligible_loan_amount) {
      setCustomAmount(eligibility.eligible_loan_amount.toString());
    }
  }, [eligibility]);

  const actionMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      
      // For approval, use custom amount (capped at eligible max)
      const approvedAmount = action === "approve" && eligibility 
        ? (Number(customAmount) || eligibility.eligible_loan_amount)
        : null;
      const tenureDays = action === "approve" && eligibility 
        ? eligibility.recommended_tenure_days 
        : null;
      const interestRate = action === "approve" && eligibility 
        ? eligibility.recommended_interest_rate 
        : null;

      // Build comments: combine rejection reason + additional comments
      const fullComments = action === "reject"
        ? [rejectionReason, comments].filter(Boolean).join(" - ")
        : comments;

      // Create approval record (audit trail only)
      const { error: approvalError } = await supabase
        .from("loan_approvals")
        .insert({
          loan_application_id: applicationId,
          approver_id: userId,
          approver_role: "credit_manager",
          approval_level: "final",
          approval_status: action === "approve" ? "approved" : "rejected",
          approved_amount: approvedAmount,
          comments: fullComments,
        });

      if (approvalError) throw approvalError;

      // Save rejection reason on the application itself for table display
      if (action === "reject") {
        await supabase
          .from("loan_applications")
          .update({ rejection_reason: rejectionReason })
          .eq("id", applicationId);
      }

      // Sync eligibility derived values when approving with a different amount
      if (action === "approve" && approvedAmount && tenureDays && interestRate) {
        const recalcInterest = approvedAmount * (interestRate / 100) * tenureDays;
        const recalcRepayment = approvedAmount + recalcInterest;
        
        await supabase
          .from("loan_eligibility")
          .update({
            eligible_loan_amount: approvedAmount,
            total_interest: Math.round(recalcInterest * 100) / 100,
            total_repayment: Math.round(recalcRepayment * 100) / 100,
            daily_emi: 0, // ADHO model
          })
          .eq("loan_application_id", applicationId);
      }

      // Update application - guarded stage transition
      const newStage = action === "approve" ? "approved" : "rejected";
      const { data: transitionResult, error: updateError } = await supabase
        .rpc("transition_loan_stage", {
          p_application_id: applicationId,
          p_expected_current_stage: "evaluation",
          p_new_stage: newStage,
          p_approved_by: action === "approve" ? userId : null,
          p_approved_amount: approvedAmount,
          p_tenure_days: tenureDays,
          p_interest_rate: interestRate,
        });

      if (updateError) throw updateError;
      if (!transitionResult) throw new Error("Application stage has changed. Please refresh and try again.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-approvals", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["approval-queue"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });

      toast({
        title: action === "approve" ? "Application Approved" : "Application Rejected",
        description: `The application has been ${action}d successfully.`,
      });

      onOpenChange(false);
      setComments("");
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!permissions.canApproveLoans && action === "approve") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permission Denied</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You don't have permission to approve loan applications.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  if (!permissions.canRejectLoans && action === "reject") {
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
            {action === "approve" ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Approve Application
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                Reject Application
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? "Review and confirm the approved loan details from eligibility assessment."
              : "Provide reason for rejection."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {action === "approve" && (
            <>
              {eligibilityLoading ? (
                <p className="text-muted-foreground text-sm">Loading eligibility data...</p>
              ) : eligibility ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Eligible Amount:</span>
                      <span className="font-semibold">₹{eligibility.eligible_loan_amount?.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tenure:</span>
                      <span className="font-medium">{eligibility.recommended_tenure_days} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Interest Rate:</span>
                      <span className="font-medium">{eligibility.recommended_interest_rate}%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="approvedAmount">Approved Amount</Label>
                    <Input
                      id="approvedAmount"
                      type="number"
                      value={customAmount}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val <= (eligibility.eligible_loan_amount ?? Infinity)) {
                          setCustomAmount(e.target.value);
                        }
                      }}
                      max={eligibility.eligible_loan_amount ?? undefined}
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      Must not exceed max eligible: ₹{eligibility.eligible_loan_amount?.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm text-yellow-700">No eligibility assessment found. Please complete eligibility calculation first.</p>
                </div>
              )}
            </>
          )}

          {action === "reject" && (
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
          )}

          <div className="space-y-2">
            <Label htmlFor="comments">
              {action === "approve" ? "Comments (Optional)" : "Additional Comments (Optional)"}
            </Label>
            <Textarea
              id="comments"
              placeholder={
                action === "approve"
                  ? "Add any additional comments..."
                  : "Add any additional details..."
              }
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
            variant={action === "approve" ? "default" : "destructive"}
            onClick={() => actionMutation.mutate()}
            disabled={
              actionMutation.isPending ||
              (action === "approve" && !eligibility) ||
              (action === "reject" && !rejectionReason)
            }
          >
            {actionMutation.isPending
              ? "Processing..."
              : action === "approve"
              ? "Approve"
              : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
