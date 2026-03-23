import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";

interface BankAccountVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function BankAccountVerificationDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: BankAccountVerificationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    account_number: existingVerification?.request_data?.account_number || "",
    ifsc_code: existingVerification?.request_data?.ifsc_code || "",
    account_holder_name: existingVerification?.response_data?.account_holder_name || "",
    bank_name: existingVerification?.response_data?.bank_name || "",
    branch_name: existingVerification?.response_data?.branch_name || "",
    status: existingVerification?.status || "pending",
    remarks: existingVerification?.remarks || "",
  });

  // Fetch primary applicant's bank details (handle duplicates)
  const { data: primaryApplicant } = useQuery({
    queryKey: ["primary-applicant-bank", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_applicants")
        .select("bank_account_number, bank_ifsc_code, bank_name, bank_account_holder_name, bank_branch")
        .eq("loan_application_id", applicationId)
        .eq("applicant_type", "primary")
        .order("bank_account_number", { ascending: false, nullsFirst: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: open,
  });

  // Fetch bank statement OCR data from uploaded document
  const { data: bankStatementOcr } = useQuery({
    queryKey: ["bank-statement-ocr", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_documents")
        .select("ocr_data")
        .eq("loan_application_id", applicationId)
        .eq("document_type", "bank_statement")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.ocr_data as Record<string, any> | null;
    },
    enabled: !!applicationId,
  });

  // Auto-populate from applicant data (fill empty fields only)
  useEffect(() => {
    if (existingVerification) return;
    const source = primaryApplicant || applicant;
    if (source && (source.bank_account_number || source.bank_ifsc_code)) {
      setFormData(prev => ({
        ...prev,
        account_number: source.bank_account_number || prev.account_number,
        ifsc_code: source.bank_ifsc_code || prev.ifsc_code,
        account_holder_name: source.bank_account_holder_name || prev.account_holder_name,
        bank_name: source.bank_name || prev.bank_name,
        branch_name: source.bank_branch || prev.branch_name,
      }));
    }
  }, [primaryApplicant, applicant, existingVerification]);

  // Pre-fill from bank statement OCR data (fill empty fields, even with existing verification)
  useEffect(() => {
    if (bankStatementOcr) {
      setFormData(prev => ({
        ...prev,
        account_number: prev.account_number || bankStatementOcr.account_number || "",
        ifsc_code: prev.ifsc_code || bankStatementOcr.ifsc_code || "",
        account_holder_name: prev.account_holder_name || bankStatementOcr.account_holder_name || "",
        bank_name: prev.bank_name || bankStatementOcr.bank_name || "",
        branch_name: prev.branch_name || bankStatementOcr.branch_name || "",
      }));
    }
  }, [bankStatementOcr]);

  // Verify Bank Account via Surepass API
  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!formData.account_number || !formData.ifsc_code) {
        throw new Error("Please enter account number and IFSC code");
      }

      const { data, error } = await supabase.functions.invoke('surepass-bank-verify', {
        body: {
          accountNumber: formData.account_number,
          ifscCode: formData.ifsc_code,
          applicationId,
          orgId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Bank verification failed");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Bank Account Verified",
        description: data.is_mock 
          ? "Verified in mock mode (configure Surepass credentials for live verification)"
          : "Bank account details verified successfully",
      });
      // Update form with verified data
      setFormData(prev => ({
        ...prev,
        account_holder_name: data.data.account_holder_name || prev.account_holder_name,
        status: data.verification_status,
      }));
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Failed to verify bank account",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "bank_account",
        verification_source: "surepass",
        status: formData.status,
        request_data: {
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
        },
        response_data: {
          account_holder_name: formData.account_holder_name,
          bank_name: formData.bank_name,
          branch_name: formData.branch_name,
        },
        remarks: formData.remarks,
        verified_at: new Date().toISOString(),
      };

      if (existingVerification) {
        const { error } = await supabase
          .from("loan_verifications")
          .update(verificationData)
          .eq("id", existingVerification.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loan_verifications")
          .insert(verificationData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
      toast({ title: "Bank account verification saved successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save verification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bank Account Verification</DialogTitle>
          <DialogDescription>
            Verify bank account details via Surepass API
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Applicant Data Indicator */}
          {primaryApplicant?.bank_account_number && (
            <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md text-sm">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span>Bank details auto-populated from applicant record</span>
            </div>
          )}

          {/* IFSC Code */}
          <div>
            <Label>IFSC Code</Label>
            <Input
              value={formData.ifsc_code}
              onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
              placeholder="Enter IFSC code"
            />
          </div>

          {/* Account Number */}
          <div>
            <Label>Account Number</Label>
            <Input
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              placeholder="Enter account number"
            />
          </div>

          {/* Verify Button */}
          <Button
            onClick={() => verifyMutation.mutate()}
            disabled={!formData.account_number || !formData.ifsc_code || verifyMutation.isPending}
            variant="default"
            className="w-full"
          >
            {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify Account
          </Button>

          {/* Verification Success Indicator */}
          {formData.status === "success" && formData.account_holder_name && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-800">Verified: {formData.account_holder_name}</span>
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Verification Results</h4>
          </div>

          <div>
            <Label>Account Holder Name</Label>
            <Input
              value={formData.account_holder_name}
              onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
              placeholder="As per bank records"
            />
          </div>

          <div>
            <Label>Bank Name</Label>
            <Input
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              placeholder="Bank name"
            />
          </div>

          <div>
            <Label>Branch Name</Label>
            <Input
              value={formData.branch_name}
              onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
              placeholder="Branch name"
            />
          </div>

          <div>
            <Label>Verification Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Remarks</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Additional notes or observations"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
