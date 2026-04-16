import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, FileCheck, X, Sparkles, ArrowLeft, CheckCircle, AlertTriangle, Edit2, Eye } from "lucide-react";
import { DocumentPreviewDialog } from "@/components/LOS/Verification/DocumentPreviewDialog";
import { calculateLoanDetails, getTodayIST, calcMaturityDate } from "@/utils/loanCalculations";
import { useOrgContext } from "@/hooks/useOrgContext";

interface BankDetails {
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}

interface ProofUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  sanctionId?: string;
  disbursementAmount?: number;
  bankDetails?: BankDetails;
  disbursementId?: string;
  isReupload?: boolean;
  onSuccess?: () => void;
}

export default function ProofUploadDialog({
  open,
  onOpenChange,
  applicationId,
  sanctionId,
  disbursementAmount,
  bankDetails,
  disbursementId,
  isReupload,
  onSuccess,
}: ProofUploadDialogProps) {
  const queryClient = useQueryClient();
  const { orgId } = useOrgContext();
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "confirm">("upload");
  const [utrNumber, setUtrNumber] = useState("");
  const [disbursementDate, setDisbursementDate] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [ocrExtracted, setOcrExtracted] = useState(false);
  const [targetDisbursementIdState, setTargetDisbursementIdState] = useState<string | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Step 1: Upload file and run OCR
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      let targetDisbursementId = disbursementId;

      // If no disbursementId provided, create a new disbursement record first
      if (!targetDisbursementId) {
        if (!sanctionId) throw new Error("No sanction found");
        if (!disbursementAmount) throw new Error("No disbursement amount");
        if (!bankDetails?.accountNumber) throw new Error("Bank details not available");

        const disbursementNumber = `DISB${Date.now()}`;

        const { data: newDisbursement, error: insertError } = await supabase
          .from("loan_disbursements")
          .insert({
            loan_application_id: applicationId,
            sanction_id: sanctionId,
            disbursement_number: disbursementNumber,
            disbursement_amount: disbursementAmount,
            beneficiary_name: bankDetails.beneficiaryName,
            account_number: bankDetails.accountNumber,
            ifsc_code: bankDetails.ifscCode,
            bank_name: bankDetails.bankName,
            payment_mode: "neft",
            status: "pending",
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        targetDisbursementId = newDisbursement.id;
      }

      // Upload file to R2
      const filePath = await uploadFileToR2(file, orgId, applicationId, "disbursement-proofs");

      // Update proof path immediately
      await supabase
        .from("loan_disbursements")
        .update({
          proof_document_path: filePath,
          proof_uploaded_at: new Date().toISOString(),
          proof_uploaded_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetDisbursementId);

      // Try OCR extraction
      let extractedUtr: string | null = null;
      let extractedDate: string | null = null;

      try {
        setIsExtracting(true);
        const { data: docInsert, error: docError } = await supabase
          .from("loan_documents")
          .insert({
            loan_application_id: applicationId,
            document_type: "disbursement_proof",
            document_category: "other",
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            upload_status: "uploaded",
            verification_status: "pending",
          })
          .select("id")
          .single();

        if (!docError && docInsert) {
          const { data: parseResult, error: parseError } = await supabase.functions.invoke(
            "parse-loan-document",
            {
              body: {
                documentId: docInsert.id,
                documentType: "disbursement_proof",
                filePath,
              },
            }
          );

          if (!parseError && parseResult?.success && parseResult.data) {
            extractedUtr = parseResult.data.utr_number || null;
            extractedDate = parseResult.data.transaction_date || null;
          }
        }
      } catch (parseErr) {
        console.error("[ProofUpload] Error parsing UTR proof:", parseErr);
      } finally {
        setIsExtracting(false);
      }

      return { targetDisbursementId, filePath, extractedUtr, extractedDate };
    },
    onSuccess: (data) => {
      setTargetDisbursementIdState(data.targetDisbursementId);
      setUploadedFilePath(data.filePath);
      setUtrNumber(data.extractedUtr || "");
      setDisbursementDate(data.extractedDate || getTodayIST());
      setOcrExtracted(!!data.extractedUtr);
      setStep("confirm");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Step 2: Confirm/edit and finalize
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!utrNumber.trim()) throw new Error("UTR number is required");
      const finalDisbursementId = targetDisbursementIdState || disbursementId;
      if (!finalDisbursementId) throw new Error("No disbursement record found");

      const { error: updateError } = await supabase
        .from("loan_disbursements")
        .update({
          utr_number: utrNumber.trim(),
          disbursement_date: disbursementDate || new Date().toISOString(),
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", finalDisbursementId);

      if (updateError) throw updateError;

      // Only transition loan stage on first disbursement (not re-upload)
      if (!isReupload) {
        const { data: transitioned, error: stageError } = await supabase
          .rpc("transition_loan_stage", {
            p_application_id: applicationId,
            p_expected_current_stage: "disbursement",
            p_new_stage: "disbursed",
          });

        if (stageError) throw stageError;
        if (!transitioned) throw new Error("Application stage has changed. Please refresh.");

        // Auto-generate repayment schedule so loan appears in Collections
        try {
          const { data: app } = await supabase
            .from("loan_applications")
            .select("approved_amount, interest_rate, tenure_days")
            .eq("id", applicationId)
            .single();

          if (app && sanctionId && orgId) {
            // Check if schedule already exists
            const { count } = await supabase
              .from("loan_repayment_schedule")
              .select("id", { count: "exact", head: true })
              .eq("loan_application_id", applicationId);

            if (!count || count === 0) {
              const { totalRepayment } = calculateLoanDetails(
                app.approved_amount,
                app.interest_rate,
                app.tenure_days
              );
              const dailyEMI = Math.round(totalRepayment / app.tenure_days);
              const dailyInterest = app.approved_amount * (app.interest_rate / 100);
              let outstandingPrincipal = app.approved_amount;
              const finalDate = disbursementDate || getTodayIST();
              const scheduleItems = [];

              for (let i = 1; i <= app.tenure_days; i++) {
                const interestAmount = Math.round(dailyInterest * 100) / 100;
                const principalAmount = Math.round((dailyEMI - interestAmount) * 100) / 100;
                outstandingPrincipal -= principalAmount;

                const dueDateStr = calcMaturityDate(finalDate, i);

                scheduleItems.push({
                  loan_application_id: applicationId,
                  sanction_id: sanctionId,
                  org_id: orgId,
                  emi_number: i,
                  due_date: dueDateStr,
                  principal_amount: principalAmount,
                  interest_amount: interestAmount,
                  total_emi: dailyEMI,
                  outstanding_principal: Math.max(0, Math.round(outstandingPrincipal * 100) / 100),
                  status: "pending",
                  amount_paid: 0,
                  late_fee: 0,
                });
              }

              await supabase
                .from("loan_repayment_schedule")
                .insert(scheduleItems);
            }
          }
        } catch (scheduleErr) {
          console.error("[ProofUpload] Error auto-generating repayment schedule:", scheduleErr);
          // Non-blocking: disbursement still succeeds even if schedule generation fails
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["unified-disbursals"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["emi-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["emi-stats"] });
      toast.success(isReupload
        ? `UTR proof updated! UTR: ${utrNumber.trim()}`
        : `Disbursement completed! UTR: ${utrNumber.trim()}`);
      resetAndClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Please upload a PDF or image file");
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetAndClose = () => {
    setFile(null);
    setStep("upload");
    setUtrNumber("");
    setDisbursementDate("");
    setOcrExtracted(false);
    setTargetDisbursementIdState(null);
    setUploadedFilePath(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {step === "upload"
              ? (isReupload ? "Re-upload UTR Proof" : "Upload UTR Proof")
              : "Confirm Disbursement Details"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? (isReupload
                ? "Upload a new UTR proof to replace the existing one."
                : "Upload the UTR confirmation or bank transfer proof.")
              : "Review and confirm the UTR number and date."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === "upload" ? (
            <>
              <div className="p-3 bg-primary/10 rounded-lg flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">AI-Powered Extraction</span>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    UTR number and date will be auto-extracted. You can review and edit before confirming.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proof-file">Proof Document</Label>
                <Input
                  id="proof-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Accepted formats: PDF, JPG, PNG (max 10MB)
                </p>
              </div>

              {file && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetAndClose}>
                  Cancel
                </Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!file || uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isExtracting ? "Extracting..." : "Uploading..."}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload & Extract
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* OCR status indicator */}
              {ocrExtracted ? (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="text-sm">
                    <span className="font-medium text-green-700">Auto-extracted from document</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Review the values below and edit if needed.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <span className="font-medium text-amber-700">Could not extract details</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Please enter the UTR number and transaction date manually.
                    </p>
                  </div>
                </div>
              )}

              {/* View uploaded slip */}
              {uploadedFilePath && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    <span className="text-sm truncate max-w-[200px]">{file?.name || "Uploaded Slip"}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowPreview(true)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="utr-number" className="flex items-center gap-1">
                    UTR Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="utr-number"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="Enter UTR / transaction reference number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="disbursement-date">Transaction Date</Label>
                  <Input
                    id="disbursement-date"
                    type="date"
                    value={disbursementDate ? disbursementDate.split("T")[0] : ""}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-between">
                <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={() => confirmMutation.mutate()}
                  disabled={!utrNumber.trim() || confirmMutation.isPending}
                >
                  {confirmMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {isReupload ? "Update UTR Proof" : "Complete Disbursement"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        <DocumentPreviewDialog
          open={showPreview}
          onClose={() => setShowPreview(false)}
          document={uploadedFilePath ? { file_path: uploadedFilePath, file_name: file?.name || "UTR Proof" } : null}
          title="UTR Proof Document"
        />
      </DialogContent>
    </Dialog>
  );
}
