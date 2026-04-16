import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Landmark, Edit2, Save, X, Upload, CheckCircle, Loader2, AlertCircle, ShieldCheck, FileUp } from "lucide-react";
import { toast } from "sonner";

interface BankDetailsSectionProps {
  applicationId: string;
  orgId: string;
  applicantId?: string;
}

interface BankDetails {
  bank_account_number: string;
  bank_ifsc_code: string;
  bank_name: string;
  bank_branch: string;
  bank_account_holder_name: string;
  bank_account_type: string;
  bank_verified: boolean;
  bank_verified_at: string | null;
  bank_verification_method?: string | null;
}

export function BankDetailsSection({ applicationId, orgId, applicantId }: BankDetailsSectionProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showManualVerification, setShowManualVerification] = useState(false);
  const [manualUtr, setManualUtr] = useState("");
  const [manualProofFile, setManualProofFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<BankDetails>({
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_name: "",
    bank_branch: "",
    bank_account_holder_name: "",
    bank_account_type: "savings",
    bank_verified: false,
    bank_verified_at: null,
    bank_verification_method: null,
  });

  // Fetch applicant data with bank details
  const { data: applicant, isLoading } = useQuery({
    queryKey: ["applicant-bank-details", applicantId],
    queryFn: async () => {
      if (!applicantId) return null;
      const { data, error } = await supabase
        .from("loan_applicants")
        .select("bank_account_number, bank_ifsc_code, bank_name, bank_branch, bank_account_holder_name, bank_account_type, bank_verified, bank_verified_at, bank_verification_method")
        .eq("id", applicantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!applicantId,
  });


  // Populate form with existing data or parsed data
  useEffect(() => {
    const applicantHasBankData = applicant?.bank_account_number || applicant?.bank_ifsc_code;
    
    if (applicant && applicantHasBankData) {
      setFormData({
        bank_account_number: applicant.bank_account_number || "",
        bank_ifsc_code: applicant.bank_ifsc_code || "",
        bank_name: applicant.bank_name || "",
        bank_branch: applicant.bank_branch || "",
        bank_account_holder_name: applicant.bank_account_holder_name || "",
        bank_account_type: applicant.bank_account_type || "savings",
        bank_verified: applicant.bank_verified || false,
        bank_verified_at: applicant.bank_verified_at || null,
        bank_verification_method: (applicant as any).bank_verification_method || null,
      });
    }
  }, [applicant]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<BankDetails>) => {
      if (!applicantId) throw new Error("No applicant record found");
      const { error } = await supabase
        .from("loan_applicants")
        .update(data)
        .eq("id", applicantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bank details saved successfully");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId, orgId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save bank details");
    },
  });

  // Bank verification mutation via Surepass API
  const verifyBankMutation = useMutation({
    mutationFn: async () => {
      if (!formData.bank_account_number || !formData.bank_ifsc_code) {
        throw new Error("Account number and IFSC code are required for verification");
      }
      const { data, error } = await supabase.functions.invoke("surepass-bank-verify", {
        body: {
          accountNumber: formData.bank_account_number,
          ifscCode: formData.bank_ifsc_code,
          applicationId,
          orgId,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Verification failed");
      return data;
    },
    onSuccess: async (data) => {
      if (data.data?.is_valid) {
        const { error } = await supabase
          .from("loan_applicants")
          .update({
            bank_verified: true,
            bank_verified_at: new Date().toISOString(),
            bank_account_holder_name: data.data.account_holder_name || formData.bank_account_holder_name,
            bank_verification_method: "api",
          } as any)
          .eq("id", applicantId);
        
        if (error) {
          toast.error("Verified but failed to save status");
          return;
        }
        
        setFormData(prev => ({
          ...prev,
          bank_verified: true,
          bank_verified_at: new Date().toISOString(),
          bank_account_holder_name: data.data.account_holder_name || prev.bank_account_holder_name,
          bank_verification_method: "api",
        }));
        
        queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicantId] });
        toast.success("Bank account verified successfully");
      } else if (data.verification_status === "error") {
        toast.warning(data.error || "Bank verification service is temporarily unavailable. Please try again later.");
        setShowManualVerification(true);
      } else {
        toast.error("Bank verification failed - account details may be incorrect");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to verify bank account");
      setShowManualVerification(true);
    },
  });

  // Manual bank verification mutation
  const manualVerifyMutation = useMutation({
    mutationFn: async () => {
      if (!manualProofFile) throw new Error("Please upload a proof screenshot");
      if (!manualUtr.trim()) throw new Error("Please enter the UTR number");
      if (!applicantId) throw new Error("No applicant record found");

      // 1. Upload file to R2
      const fileUrl = await uploadFileToR2(manualProofFile, orgId, applicationId, "bank-verification-proof");
      const filePath = fileUrl;

      // 3. Insert verification record
      const { error: verifyError } = await supabase
        .from("loan_verifications")
        .insert({
          loan_application_id: applicationId,
          applicant_id: applicantId,
           verification_type: "bank_manual",
          request_data: { utr: manualUtr.trim() },
          response_data: { file_url: fileUrl, file_path: filePath },
          status: "verified",
        } as any);
      if (verifyError) throw new Error("Failed to save verification: " + verifyError.message);

      // 4. Update applicant
      const { error: updateError } = await supabase
        .from("loan_applicants")
        .update({
          bank_verified: true,
          bank_verified_at: new Date().toISOString(),
          bank_verification_method: "manual",
        } as any)
        .eq("id", applicantId);
      if (updateError) throw new Error("Failed to update applicant: " + updateError.message);
    },
    onSuccess: () => {
      toast.success("Bank account manually verified successfully");
      setFormData(prev => ({
        ...prev,
        bank_verified: true,
        bank_verified_at: new Date().toISOString(),
        bank_verification_method: "manual",
      }));
      setShowManualVerification(false);
      setManualUtr("");
      setManualProofFile(null);
      queryClient.invalidateQueries({ queryKey: ["applicant-bank-details", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId, orgId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Manual verification failed");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (applicant) {
      setFormData({
        bank_account_number: applicant.bank_account_number || "",
        bank_ifsc_code: applicant.bank_ifsc_code || "",
        bank_name: applicant.bank_name || "",
        bank_branch: applicant.bank_branch || "",
        bank_account_holder_name: applicant.bank_account_holder_name || "",
        bank_account_type: applicant.bank_account_type || "savings",
        bank_verified: applicant.bank_verified || false,
        bank_verified_at: applicant.bank_verified_at || null,
        bank_verification_method: (applicant as any).bank_verification_method || null,
      });
    }
    setIsEditing(false);
  };

  const hasBankDetails = formData.bank_account_number || formData.bank_ifsc_code || formData.bank_name;
  const hasParsedData = false;

  if (!applicantId) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4" />
            Bank Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Create an applicant profile first to add bank details</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const verificationBadge = formData.bank_verified ? (
    formData.bank_verification_method === "manual" ? (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
        <ShieldCheck className="h-3 w-3 mr-1" />
        Manually Verified
      </Badge>
    ) : (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
        <CheckCircle className="h-3 w-3 mr-1" />
        Verified
      </Badge>
    )
  ) : null;

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" />
              Bank Account Details
              {verificationBadge}
            </CardTitle>
            <CardDescription>
              {hasParsedData
                ? "Bank details auto-filled from bank statement. Review and save."
                : "Enter or verify bank account details for disbursement"
              }
            </CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-1" />
              {hasBankDetails ? "Edit" : "Add"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : isEditing ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Account Holder Name</Label>
              <Input
                value={formData.bank_account_holder_name}
                onChange={(e) => setFormData({ ...formData, bank_account_holder_name: e.target.value })}
                placeholder="Enter account holder name"
              />
            </div>
            <div>
              <Label className="text-xs">Account Number</Label>
              <Input
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                placeholder="Enter account number"
              />
            </div>
            <div>
              <Label className="text-xs">IFSC Code</Label>
              <Input
                value={formData.bank_ifsc_code}
                onChange={(e) => setFormData({ ...formData, bank_ifsc_code: e.target.value.toUpperCase() })}
                placeholder="e.g., HDFC0001234"
                maxLength={11}
              />
            </div>
            <div>
              <Label className="text-xs">Bank Name</Label>
              <Input
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="Enter bank name"
              />
            </div>
            <div>
              <Label className="text-xs">Branch</Label>
              <Input
                value={formData.bank_branch}
                onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                placeholder="Enter branch name"
              />
            </div>
            <div>
              <Label className="text-xs">Account Type</Label>
              <Select
                value={formData.bank_account_type}
                onValueChange={(value) => setFormData({ ...formData, bank_account_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : hasBankDetails ? (
          <div className="grid gap-x-4 gap-y-2 md:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">Account Holder</label>
              <p className="text-sm">{formData.bank_account_holder_name || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Account Number</label>
              <p className="text-sm font-mono">
                {formData.bank_account_number
                  ? `****${formData.bank_account_number.slice(-4)}`
                  : "N/A"
                }
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">IFSC Code</label>
              <p className="text-sm font-mono">{formData.bank_ifsc_code || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bank Name</label>
              <p className="text-sm">{formData.bank_name || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Branch</label>
              <p className="text-sm">{formData.bank_branch || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Account Type</label>
              <p className="text-sm capitalize">{formData.bank_account_type || "N/A"}</p>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-2">
            No bank details available. Upload a bank statement or click "Add" to enter manually.
          </div>
        )}

        {/* Bank verification */}
        {hasBankDetails && !formData.bank_verified && !isEditing && (
          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => verifyBankMutation.mutate()}
              disabled={verifyBankMutation.isPending || !formData.bank_account_number || !formData.bank_ifsc_code}
            >
              {verifyBankMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verify Bank Account
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Verify account details via Surepass API
            </p>
          </div>
        )}

        {/* Manual verification fallback */}
        {showManualVerification && !formData.bank_verified && !isEditing && (
          <div className="mt-4 pt-4 border-t">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-700">Manual Verification</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    API verification unavailable. Upload a screenshot of a ₹1 transfer to the applicant's bank account with UTR clearly visible.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">UTR Number *</Label>
                  <Input
                    value={manualUtr}
                    onChange={(e) => setManualUtr(e.target.value)}
                    placeholder="Enter UTR number from ₹1 transfer"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Transfer Proof Screenshot *</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setManualProofFile(file);
                    }}
                  />
                  <div
                    className="mt-1 border-2 border-dashed rounded-md p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {manualProofFile ? (
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <FileUp className="h-4 w-4 text-primary" />
                        <span className="truncate max-w-[200px]">{manualProofFile.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManualProofFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="h-5 w-5" />
                        <span className="text-xs">Click to upload (JPG, PNG, PDF)</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => manualVerifyMutation.mutate()}
                  disabled={manualVerifyMutation.isPending || !manualUtr.trim() || !manualProofFile}
                  className="w-full"
                >
                  {manualVerifyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Submit Manual Verification
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
