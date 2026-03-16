import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { useLOSPermissions } from "@/hooks/useLOSPermissions";
import ProofUploadDialog from "./ProofUploadDialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface DisbursementFormProps {
  applicationId: string;
}

export default function DisbursementForm({ applicationId }: DisbursementFormProps) {
  const queryClient = useQueryClient();
  const [showProofUpload, setShowProofUpload] = useState(false);
  const { permissions } = useLOSPermissions();

  // Check if disbursement already exists
  const { data: existingDisbursement } = useQuery({
    queryKey: ["loan-disbursements", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_disbursements")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Get application details
  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("approved_amount")
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Get sanction details
  const { data: sanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_sanctions")
        .select("id, processing_fee")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch primary applicant's bank details (prefer the one with bank details, handle duplicates)
  const { data: primaryApplicant } = useQuery({
    queryKey: ["primary-applicant-bank", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_applicants")
        .select("first_name, last_name, bank_account_number, bank_ifsc_code, bank_name, bank_account_holder_name")
        .eq("loan_application_id", applicationId)
        .eq("applicant_type", "primary")
        .order("bank_account_number", { ascending: false, nullsFirst: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  // Check bank verification status
  const { data: bankVerification } = useQuery({
    queryKey: ["bank-verification", applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_verifications")
        .select("status, response_data, verified_at")
        .eq("loan_application_id", applicationId)
        .eq("verification_type", "bank_account")
        .order("verified_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Extract bank details from applicant record
  const bankDetails = {
    beneficiaryName: primaryApplicant?.bank_account_holder_name || (primaryApplicant ? `${primaryApplicant.first_name} ${primaryApplicant.last_name || ""}`.trim() : ""),
    accountNumber: primaryApplicant?.bank_account_number || "",
    ifscCode: primaryApplicant?.bank_ifsc_code || "",
    bankName: primaryApplicant?.bank_name || "",
  };

  const isVerified = bankVerification?.status === "success";
  const hasBankDetails = bankDetails.accountNumber && bankDetails.ifscCode;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!permissions.canInitiateDisbursement) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            You don't have permission to initiate disbursements
          </div>
        </CardContent>
      </Card>
    );
  }

  const approvedAmount = application?.approved_amount || 0;
  const pf = sanction?.processing_fee || Math.round(approvedAmount * 0.10);
  const gstOnPf = Math.round(pf * 0.18);
  const netDisbursementAmount = approvedAmount - pf - gstOnPf;

  // If disbursement completed, show summary with re-upload option
  if (existingDisbursement && existingDisbursement.status === "completed") {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Disbursement Completed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-500/10 rounded-lg">
              <div className="text-sm text-muted-foreground">Disbursed Amount</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(existingDisbursement.disbursement_amount)}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg bg-muted/50">
              <div>
                <div className="text-sm text-muted-foreground">UTR Number</div>
                <div className="font-mono font-medium">{existingDisbursement.utr_number || "N/A"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Date</div>
                <div className="font-medium">
                  {existingDisbursement.disbursement_date
                    ? new Date(existingDisbursement.disbursement_date).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Beneficiary</div>
                <div className="font-medium">{existingDisbursement.beneficiary_name || "N/A"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Account Number</div>
                <div className="font-mono font-medium">{existingDisbursement.account_number || "N/A"}</div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowProofUpload(true)}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Re-upload UTR Proof
            </Button>
          </CardContent>
        </Card>

        <ProofUploadDialog
          open={showProofUpload}
          onOpenChange={setShowProofUpload}
          applicationId={applicationId}
          disbursementId={existingDisbursement.id}
          disbursementAmount={existingDisbursement.disbursement_amount}
          bankDetails={bankDetails}
          isReupload
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["loan-disbursements", applicationId] });
            queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId] });
          }}
        />
      </>
    );
  }

  // Show single-step upload form
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Complete Disbursement
          </CardTitle>
          <CardDescription>
            Upload UTR proof to complete the disbursement. Details will be auto-extracted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Verification Status */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            {isVerified ? (
              <>
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Bank Account Verified</span>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 ml-auto">Verified</Badge>
              </>
            ) : hasBankDetails ? (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-700">Bank details available (unverified)</span>
                <Badge variant="outline" className="ml-auto">Pending Verification</Badge>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">No bank details available</span>
              </>
            )}
          </div>

          {/* Disbursement Amount */}
          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="text-sm text-muted-foreground">Disbursement Amount</div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(netDisbursementAmount)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Approved: {formatCurrency(application?.approved_amount || 0)} - 
              Processing Fee: {formatCurrency(pf)} - 
              GST: {formatCurrency(gstOnPf)}
            </div>
          </div>

          {/* Bank Details (Read-only) */}
          {hasBankDetails && (
            <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg bg-muted/50">
              <div>
                <div className="text-sm text-muted-foreground">Beneficiary Name</div>
                <div className="font-medium">{bankDetails.beneficiaryName || "N/A"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Account Number</div>
                <div className="font-mono font-medium">{bankDetails.accountNumber}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">IFSC Code</div>
                <div className="font-mono font-medium">{bankDetails.ifscCode}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Bank Name</div>
                <div className="font-medium">{bankDetails.bankName || "N/A"}</div>
              </div>
            </div>
          )}

          <Button
            onClick={() => setShowProofUpload(true)}
            disabled={!hasBankDetails}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload UTR & Complete Disbursement
          </Button>
        </CardContent>
      </Card>

      <ProofUploadDialog
        open={showProofUpload}
        onOpenChange={setShowProofUpload}
        applicationId={applicationId}
        sanctionId={sanction?.id}
        disbursementAmount={netDisbursementAmount}
        bankDetails={bankDetails}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["loan-disbursements", applicationId] });
          queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId] });
        }}
      />
    </>
  );
}
