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

interface PANVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  applicant: any;
  existingVerification?: any;
}

export default function PANVerificationDialog({
  open,
  onClose,
  applicationId,
  orgId,
  applicant,
  existingVerification,
}: PANVerificationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch PAN card OCR data from uploaded document
  const { data: panDocOcr } = useQuery({
    queryKey: ["pan-doc-ocr", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_documents")
        .select("ocr_data")
        .eq("loan_application_id", applicationId)
        .eq("document_type", "pan_card")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.ocr_data as Record<string, any> | null;
    },
    enabled: !!applicationId,
  });

  const [formData, setFormData] = useState({
    pan_number: existingVerification?.request_data?.pan_number || applicant?.pan_number || "",
    name_on_pan: existingVerification?.response_data?.name_on_pan || existingVerification?.response_data?.name || "",
    pan_status: existingVerification?.response_data?.pan_status || "valid",
    name_match_result: existingVerification?.response_data?.name_match_result || "exact",
    status: existingVerification?.status || "success",
    remarks: existingVerification?.remarks || "",
  });

  // Pre-fill from OCR data if no existing verification
  useEffect(() => {
    if (panDocOcr && !existingVerification) {
      setFormData(prev => ({
        ...prev,
        pan_number: prev.pan_number || panDocOcr.pan_number || "",
        name_on_pan: prev.name_on_pan || panDocOcr.name || "",
      }));
    }
  }, [panDocOcr, existingVerification]);

  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Verify PAN via Surepass API
  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!formData.pan_number || formData.pan_number.length !== 10) {
        throw new Error("Please enter a valid 10-character PAN number");
      }

      const { data, error } = await supabase.functions.invoke('surepass-pan-verify', {
        body: {
          panNumber: formData.pan_number,
          applicationId,
          orgId,
        },
      });

      if (error) {
        setDebugInfo({ error: error.message, context: error.context });
        throw error;
      }
      setDebugInfo(data?.debug || null);
      if (!data.success) throw new Error(data.error || "PAN verification failed");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "PAN Verified",
        description: "PAN details have been verified successfully",
      });
      // Update form with verified data
      setFormData(prev => ({
        ...prev,
        name_on_pan: data.data.name || prev.name_on_pan,
        pan_status: data.data.is_valid ? "valid" : "invalid",
        status: data.data.is_valid ? "success" : "failed",
      }));
      queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Failed to verify PAN",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const verificationData = {
        loan_application_id: applicationId,
        applicant_id: applicant?.id,
        verification_type: "pan",
        verification_source: "surepass",
        status: formData.status,
        request_data: { pan_number: formData.pan_number },
        response_data: {
          name_on_pan: formData.name_on_pan,
          pan_status: formData.pan_status,
          name_match_result: formData.name_match_result,
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
      toast({ title: "PAN verification saved successfully" });
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
          <DialogTitle>PAN Verification</DialogTitle>
          <DialogDescription>
            Verify PAN card details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* PAN Input and Verify Button */}
          <div className="space-y-2">
            <div>
              <Label>PAN Number</Label>
              <Input
                value={formData.pan_number}
                onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase().slice(0, 10) })}
                placeholder="ABCDE1234F"
                maxLength={10}
              />
            </div>
            
            <Button
              onClick={() => verifyMutation.mutate()}
              disabled={!formData.pan_number || formData.pan_number.length !== 10 || verifyMutation.isPending}
              variant="default"
              className="w-full"
            >
              {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify PAN
            </Button>
          </div>

          {/* Verification Success Indicator */}
          {formData.status === "success" && formData.name_on_pan && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-800">Verified: {formData.name_on_pan}</span>
            </div>
          )}

          {/* Debug: Raw Request/Response */}
          {debugInfo && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground font-medium">Raw API Request & Response</summary>
              <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Verification Results</h4>
          </div>

          <div>
            <Label>Name on PAN</Label>
            <Input
              value={formData.name_on_pan}
              onChange={(e) => setFormData({ ...formData, name_on_pan: e.target.value })}
              placeholder="Full name as per PAN"
            />
          </div>

          <div>
            <Label>PAN Status</Label>
            <Select value={formData.pan_status} onValueChange={(value) => setFormData({ ...formData, pan_status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
                <SelectItem value="not_found">Not Found</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Name Match Result</Label>
            <Select value={formData.name_match_result} onValueChange={(value) => setFormData({ ...formData, name_match_result: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exact Match</SelectItem>
                <SelectItem value="partial">Partial Match</SelectItem>
                <SelectItem value="no_match">No Match</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="in_progress">In Progress</SelectItem>
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
