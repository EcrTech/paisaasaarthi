import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { CheckCircle, XCircle, Clock, Building2, Upload, FileCheck, ExternalLink, Sparkles, Eye } from "lucide-react";
import { DocumentPreviewDialog } from "@/components/LOS/Verification/DocumentPreviewDialog";
import { format } from "date-fns";
import { useLOSPermissions } from "@/hooks/useLOSPermissions";
import ProofUploadDialog from "./ProofUploadDialog";

interface DisbursementStatusProps {
  applicationId: string;
}

export default function DisbursementStatus({ applicationId }: DisbursementStatusProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [showProofPreview, setShowProofPreview] = useState(false);
  const { permissions } = useLOSPermissions();

  const { data: disbursement } = useQuery({
    queryKey: ["loan-disbursements", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_disbursements")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const getProofDocumentUrl = async (path: string) => {
    if (path.startsWith("https://")) return path;
    const { data } = await supabase.storage
      .from("loan-documents")
      .createSignedUrl(path, 3600);
    return data?.signedUrl;
  };

  const handleViewProof = async () => {
    if (disbursement?.proof_document_path) {
      const url = await getProofDocumentUrl(disbursement.proof_document_path);
      if (url) {
        window.open(url, "_blank");
      }
    }
  };

  if (!disbursement) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statusConfig = {
    pending: { icon: Clock, color: "bg-yellow-500", label: "Pending" },
    completed: { icon: CheckCircle, color: "bg-green-500", label: "Completed" },
    failed: { icon: XCircle, color: "bg-red-500", label: "Failed" },
  };

  const config = statusConfig[disbursement.status as keyof typeof statusConfig];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Disbursement Status
            </CardTitle>
            <Badge className={config.color}>{config.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Disbursement Number</div>
              <div className="font-medium font-mono">{disbursement.disbursement_number}</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(disbursement.disbursement_amount)}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Payment Mode</div>
              <div className="font-medium uppercase">{disbursement.payment_mode || "N/A"}</div>
            </div>
          </div>

          {/* UTR Details - Prominent Display */}
          {disbursement.utr_number && (
            <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-green-700 dark:text-green-400">Transaction Completed</span>
                    {disbursement.proof_document_path && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                        <Sparkles className="h-3 w-3" />
                        Extracted from proof
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-sm text-muted-foreground">UTR Number</div>
                      <div className="font-mono font-bold text-lg">{disbursement.utr_number}</div>
                    </div>
                    {disbursement.disbursement_date && (
                      <div>
                        <div className="text-sm text-muted-foreground">Transaction Date</div>
                        <div className="font-medium text-lg">
                          {format(new Date(disbursement.disbursement_date), "MMM dd, yyyy")}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bank Details */}
          <div>
            <h4 className="font-medium mb-3">Bank Details</h4>
            <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Beneficiary Name</div>
                <div className="font-medium">{disbursement.beneficiary_name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Account Number</div>
                <div className="font-medium font-mono">{disbursement.account_number}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">IFSC Code</div>
                <div className="font-medium font-mono">{disbursement.ifsc_code}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Bank Name</div>
                <div className="font-medium">{disbursement.bank_name}</div>
              </div>
            </div>
          </div>

          {disbursement.failure_reason && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-sm text-muted-foreground">Failure Reason</div>
              <div className="text-sm">{disbursement.failure_reason}</div>
            </div>
          )}

          {/* Proof of Disbursement Section */}
          <div>
            <h4 className="font-medium mb-3">Proof of Disbursement</h4>
            {disbursement.proof_document_path ? (
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-700 dark:text-green-400">Proof Uploaded</div>
                    {disbursement.proof_uploaded_at && (
                      <div className="text-xs text-muted-foreground">
                        Uploaded on {format(new Date(disbursement.proof_uploaded_at), "MMM dd, yyyy 'at' h:mm a")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowProofPreview(true)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Proof
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleViewProof}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Tab
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 border border-dashed rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground">
                    No proof uploaded yet
                  </div>
                  {disbursement.status === "pending" && permissions.canUpdateDisbursementStatus && (
                    <Button variant="secondary" onClick={() => setShowProofUpload(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload UTR Proof
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Proof Upload Dialog */}
      <ProofUploadDialog
        open={showProofUpload}
        onOpenChange={setShowProofUpload}
        disbursementId={disbursement.id}
        applicationId={applicationId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["loan-disbursements", applicationId] });
        }}
      />

      {/* Proof Preview Dialog */}
      <DocumentPreviewDialog
        open={showProofPreview}
        onClose={() => setShowProofPreview(false)}
        document={disbursement?.proof_document_path ? { file_path: disbursement.proof_document_path, file_name: "Disbursement Proof" } : null}
        title="Disbursement Proof"
      />
    </div>
  );
}
