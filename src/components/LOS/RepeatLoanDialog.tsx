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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RepeatLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  orgId: string;
  contactId: string;
  previousAmount: number;
  previousTenure: number;
}

export function RepeatLoanDialog({
  open,
  onOpenChange,
  applicationId,
  orgId,
  contactId,
  previousAmount,
  previousTenure,
}: RepeatLoanDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [requestedAmount, setRequestedAmount] = useState(previousAmount.toString());
  const [tenureDays, setTenureDays] = useState(previousTenure.toString());

  const createRepeatLoanMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();

      // Get the next application number via sequence
      const { data: seqData, error: seqError } = await supabase.rpc("nextval_text", {
        seq_name: "loan_application_number_seq",
      });
      if (seqError) throw seqError;

      const applicationNumber = `LA-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(seqData).padStart(5, "0")}`;

      // Create repeat loan application
      const { data: newApp, error } = await supabase
        .from("loan_applications")
        .insert({
          org_id: orgId,
          contact_id: contactId,
          application_number: applicationNumber,
          requested_amount: Number(requestedAmount),
          tenure_days: Number(tenureDays),
          source: "repeat_loan",
          current_stage: "evaluation",
          parent_application_id: applicationId,
          assigned_to: user?.user?.id,
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Copy applicant data from original application
      const { data: originalApplicants } = await supabase
        .from("loan_applicants")
        .select("*")
        .eq("loan_application_id", applicationId);

      if (originalApplicants && originalApplicants.length > 0) {
        const newApplicants = originalApplicants.map((applicant: any) => {
          const { id, loan_application_id, created_at, updated_at, ...rest } = applicant;
          return {
            ...rest,
            loan_application_id: newApp.id,
          };
        });

        await supabase.from("loan_applicants").insert(newApplicants);
      }

      return newApp;
    },
    onSuccess: (data) => {
      toast.success("Repeat loan application created successfully");
      queryClient.invalidateQueries({ queryKey: ["loan-application"] });
      onOpenChange(false);
      navigate(`/los/applications/${data.id}?mode=review`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create repeat loan");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Create Repeat Loan
          </DialogTitle>
          <DialogDescription>
            A new loan application will be created with existing applicant data and documents. No fresh documents are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="repeat-amount">Requested Amount (₹)</Label>
            <Input
              id="repeat-amount"
              type="number"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              placeholder="Enter amount"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repeat-tenure">Tenure (Days)</Label>
            <Input
              id="repeat-tenure"
              type="number"
              value={tenureDays}
              onChange={(e) => setTenureDays(e.target.value)}
              placeholder="Enter tenure in days"
            />
          </div>
          <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            <p>• Applicant details will be copied from the previous application</p>
            <p>• The new application starts at the Assessment stage</p>
            <p>• Existing documents will be linked automatically</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createRepeatLoanMutation.mutate()}
            disabled={createRepeatLoanMutation.isPending || !requestedAmount || !tenureDays}
          >
            {createRepeatLoanMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Create Repeat Loan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
