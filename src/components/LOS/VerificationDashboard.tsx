import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Edit, AlertCircle, Eye, Upload, Video, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PANVerificationDialog from "./Verification/PANVerificationDialog";
import AadhaarVerificationDialog from "./Verification/AadhaarVerificationDialog";
import BankAccountVerificationDialog from "./Verification/BankAccountVerificationDialog";
import VerificationDetailsDialog from "./Verification/VerificationDetailsDialog";
import { VideoKYCRetryButton } from "./Verification/VideoKYCRetryButton";
import { VideoKYCViewDialog } from "./Verification/VideoKYCViewDialog";
import { IdentityDocumentCard } from "./Verification/IdentityDocumentCard";
import { IdentityDocumentUploadDialog } from "./Verification/IdentityDocumentUploadDialog";
import { DocumentPreviewDialog } from "./Verification/DocumentPreviewDialog";

interface VerificationDashboardProps {
  applicationId: string;
  orgId: string;
}

const VERIFICATION_TYPES = [
  { 
    type: "video_kyc", 
    name: "Video KYC", 
    description: "Live video verification session",
    category: "identity"
  },
  { 
    type: "pan", 
    name: "PAN Verification", 
    description: "Verify PAN card details via NSDL",
    category: "identity"
  },
  { 
    type: "aadhaar", 
    name: "Aadhaar Verification", 
    description: "Verify Aadhaar details via UIDAI",
    category: "identity"
  },
  { 
    type: "bank_account", 
    name: "Bank Account Verification", 
    description: "Verify bank account via penny drop",
    category: "financial"
  },
];

const STATUS_CONFIG = {
  pending: { color: "bg-muted", icon: Clock, label: "Pending", textColor: "text-muted-foreground" },
  in_progress: { color: "bg-blue-500", icon: Clock, label: "In Progress", textColor: "text-blue-600" },
  success: { color: "bg-green-500", icon: CheckCircle, label: "Verified", textColor: "text-green-600" },
  failed: { color: "bg-red-500", icon: XCircle, label: "Failed", textColor: "text-red-600" },
};

export default function VerificationDashboard({ applicationId, orgId }: VerificationDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVerification, setSelectedVerification] = useState<{ type: string; data: any } | null>(null);
  const [detailsVerification, setDetailsVerification] = useState<{ verification: any; type: typeof VERIFICATION_TYPES[0] } | null>(null);
  const [videoKYCViewOpen, setVideoKYCViewOpen] = useState(false);
  const [videoKYCRecordingUrl, setVideoKYCRecordingUrl] = useState<string | null>(null);
  const [uploadDocType, setUploadDocType] = useState<"pan_card" | "aadhaar_front" | "aadhaar_back" | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ document: any; title: string } | null>(null);

  const { data: verifications = [], isLoading } = useQuery({
    queryKey: ["loan-verifications", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_verifications")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*, loan_applicants(*)")
        .eq("id", applicationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  // Query for identity documents (PAN and Aadhaar cards)
  const { data: identityDocuments = [] } = useQuery({
    queryKey: ["identity-documents", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_documents")
        .select("*")
        .eq("loan_application_id", applicationId)
        .in("document_type", ["pan_card", "aadhaar_card", "aadhaar_front", "aadhaar_back"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const getPanDocument = () => identityDocuments.find(d => d.document_type === "pan_card");
  const getAadhaarFrontDocument = () => identityDocuments.find(d => 
    d.document_type === "aadhaar_card" || d.document_type === "aadhaar_front"
  );
  const getAadhaarBackDocument = () => identityDocuments.find(d => d.document_type === "aadhaar_back");

  // Fetch Aadhaar verification results directly from dashboard
  const [fetchingAadhaarResults, setFetchingAadhaarResults] = useState(false);
  const fetchAadhaarResults = async () => {
    // Query database directly for the latest aadhaar verification with a request number
    // (cached verifications state may be stale)
    const { data: freshRecords } = await supabase
      .from("loan_verifications")
      .select("request_data")
      .eq("loan_application_id", applicationId)
      .eq("verification_type", "aadhaar")
      .order("created_at", { ascending: false })
      .limit(10);

    let uniqueRequestNumber: string | null = null;
    if (freshRecords) {
      for (const v of freshRecords) {
        const reqNum = (v.request_data as Record<string, any>)?.unique_request_number;
        if (reqNum) {
          uniqueRequestNumber = reqNum;
          break;
        }
      }
    }
    if (!uniqueRequestNumber) {
      toast({ variant: "destructive", title: "No request number", description: "Could not find a DigiLocker request number. Please open the Aadhaar dialog and initiate a new verification." });
      return;
    }
    setFetchingAadhaarResults(true);
    try {
      const { data, error } = await supabase.functions.invoke('verifiedu-aadhaar-details', {
        body: { uniqueRequestNumber, applicationId, orgId },
      });
      if (error) throw error;
      if (data?.mismatch) {
        toast({ variant: "destructive", title: "Data Mismatch", description: "The verification service returned data for a different request. Please initiate a new Aadhaar verification." });
      } else if (data?.still_processing) {
        toast({ title: "Verification Pending", description: "Customer has not completed DigiLocker verification yet. Please try again later." });
      } else if (data?.success && data?.data?.is_valid) {
        toast({ title: "Aadhaar Verified!", description: `Customer ${data.data.name || ""} verified successfully via DigiLocker` });
        queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
      } else if (data?.success && data?.data && !data?.data?.is_valid) {
        toast({ variant: "destructive", title: "Verification Failed", description: "Aadhaar verification returned invalid. Customer may need to retry." });
        queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] });
      } else if (data?.error) {
        toast({ variant: "destructive", title: "Error", description: data.message || data.error });
      } else {
        toast({ title: "Verification Pending", description: "Customer has not completed DigiLocker verification yet. Please try again later." });
      }
    } catch (err: any) {
      console.error("Aadhaar fetch error:", err);
      toast({ variant: "destructive", title: "Fetch Failed", description: err.message || "Failed to fetch Aadhaar results." });
    } finally {
      setFetchingAadhaarResults(false);
    }
  };

  const updateStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const { error } = await supabase
        .from("loan_applications")
        .update({ 
          current_stage: newStage,
          updated_at: new Date().toISOString()
        })
        .eq("id", applicationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      toast({ title: "Application stage updated" });
    },
  });

  const getVerificationStatus = (type: string) => {
    const verification = verifications.find((v) => v.verification_type === type);
    return verification ? verification.status : "pending";
  };

  const getVerification = (type: string) => {
    return verifications.find((v) => v.verification_type === type);
  };

  const allVerificationsComplete = VERIFICATION_TYPES.every(
    (v) => getVerificationStatus(v.type) === "success"
  );

  const anyVerificationFailed = VERIFICATION_TYPES.some(
    (v) => getVerificationStatus(v.type) === "failed"
  );

  // Check if all verifications are either success or failed (not pending/in_progress)
  const allVerificationsProcessed = VERIFICATION_TYPES.every(
    (v) => ["success", "failed"].includes(getVerificationStatus(v.type))
  );

  const handleMoveToAssessment = () => {
    // Allow moving forward if all verifications are processed (even with failures)
    if (allVerificationsComplete || allVerificationsProcessed) {
      updateStageMutation.mutate("credit_assessment");
    }
  };

  const primaryApplicant = application?.loan_applicants?.[0];

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Summary</CardTitle>
          <CardDescription>
            Complete all verifications to proceed to credit assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-2xl font-bold">
                {VERIFICATION_TYPES.filter((v) => getVerificationStatus(v.type) === "success").length}/
                {VERIFICATION_TYPES.length}
              </div>
              <p className="text-sm text-muted-foreground">Verifications Complete</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {VERIFICATION_TYPES.filter((v) => getVerificationStatus(v.type) === "in_progress").length}
              </div>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {VERIFICATION_TYPES.filter((v) => getVerificationStatus(v.type) === "failed").length}
              </div>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>

          {allVerificationsComplete && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-900">All verifications complete!</p>
                </div>
                <Button onClick={handleMoveToAssessment}>
                  Move to Credit Assessment
                </Button>
              </div>
            </div>
          )}

          {anyVerificationFailed && !allVerificationsComplete && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">
                      Some verifications have failed.
                    </p>
                    <p className="text-sm text-amber-700">
                      You can still proceed with failed verifications or retry them.
                    </p>
                  </div>
                </div>
                {allVerificationsProcessed && (
                  <Button onClick={handleMoveToAssessment} variant="outline">
                    Proceed Anyway
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {VERIFICATION_TYPES.map((verificationType) => {
          const status = getVerificationStatus(verificationType.type);
          const verification = getVerification(verificationType.type);
          const StatusIcon = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].icon;

          return (
            <Card key={verificationType.type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].textColor}`} />
                    <div>
                      <CardTitle className="text-lg">{verificationType.name}</CardTitle>
                      <CardDescription>{verificationType.description}</CardDescription>
                    </div>
                  </div>
                  <Badge className={STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].color}>
                    {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Display matched/verified details */}
                {verification?.response_data && typeof verification.response_data === 'object' && !Array.isArray(verification.response_data) && (
                  <div className="mb-3 p-3 bg-muted/50 rounded-md border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Verified Details</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {verificationType.type === "pan" && (
                        <>
                          {(verification.response_data as Record<string, any>).name_on_pan && (
                            <div>
                              <span className="text-muted-foreground">Name: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).name_on_pan}</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).pan_status && (
                            <div>
                              <span className="text-muted-foreground">Status: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).pan_status === "valid" ? "default" : "destructive"} className="text-xs">
                                {(verification.response_data as Record<string, any>).pan_status}
                              </Badge>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).name_match_result && (
                            <div>
                              <span className="text-muted-foreground">Name Match: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).name_match_result === "exact" ? "default" : "secondary"} className="text-xs">
                                {(verification.response_data as Record<string, any>).name_match_result}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                      {verificationType.type === "aadhaar" && (
                        <>
                          {(verification.response_data as Record<string, any>).name_on_aadhaar && (
                            <div>
                              <span className="text-muted-foreground">Name: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).name_on_aadhaar}</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).address_match && (
                            <div>
                              <span className="text-muted-foreground">Address Match: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).address_match === "exact" ? "default" : "secondary"} className="text-xs">
                                {(verification.response_data as Record<string, any>).address_match}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                      {verificationType.type === "bank_account" && (
                        <>
                          {(verification.response_data as Record<string, any>).account_holder_name && (
                            <div>
                              <span className="text-muted-foreground">Holder: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).account_holder_name}</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).account_status && (
                            <div>
                              <span className="text-muted-foreground">Status: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).account_status === "active" ? "default" : "destructive"} className="text-xs">
                                {(verification.response_data as Record<string, any>).account_status}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                      {verificationType.type === "video_kyc" && (
                        <>
                          {(verification.response_data as Record<string, any>).face_match_score && (
                            <div>
                              <span className="text-muted-foreground">Face Match: </span>
                              <span className="font-medium">{(verification.response_data as Record<string, any>).face_match_score}%</span>
                            </div>
                          )}
                          {(verification.response_data as Record<string, any>).liveness_check && (
                            <div>
                              <span className="text-muted-foreground">Liveness: </span>
                              <Badge variant={(verification.response_data as Record<string, any>).liveness_check === "passed" ? "default" : "destructive"} className="text-xs">
                                {(verification.response_data as Record<string, any>).liveness_check}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {verification && verification.remarks && (
                  <div className="mb-3 p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">{verification.remarks}</p>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap items-center">
                  {verification && status !== "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailsVerification({ verification, type: verificationType })}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  )}
                  
                  {/* Fetch Results button for Aadhaar in_progress */}
                  {verificationType.type === "aadhaar" && status === "in_progress" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={fetchAadhaarResults}
                      disabled={fetchingAadhaarResults}
                    >
                      {fetchingAadhaarResults ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {fetchingAadhaarResults ? "Fetching..." : "Fetch Results"}
                    </Button>
                  )}

                  {/* Special handling for VideoKYC */}
                  {verificationType.type === "video_kyc" ? (
                    <>
                      {status === "success" && verification?.response_data && (verification.response_data as Record<string, any>).recording_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setVideoKYCRecordingUrl((verification.response_data as Record<string, any>).recording_url);
                            setVideoKYCViewOpen(true);
                          }}
                        >
                          <Video className="h-4 w-4 mr-2" />
                          View Recording
                        </Button>
                      )}
                      {(status === "pending" || status === "failed") && primaryApplicant && (
                        <VideoKYCRetryButton
                          applicationId={applicationId}
                          orgId={orgId}
                          applicantName={`${primaryApplicant.first_name || ''} ${primaryApplicant.last_name || ''}`.trim()}
                          applicantPhone={(primaryApplicant as any).mobile_number || (primaryApplicant as any).phone}
                          applicantEmail={primaryApplicant.email}
                          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["loan-verifications", applicationId] })}
                        />
                      )}
                    </>
                  ) : (
                    <Button
                      variant={status === "pending" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedVerification({ type: verificationType.type, data: verification })}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {status === "pending" ? "Start Verification" : "Update"}
                    </Button>
                  )}
                </div>

                {/* Identity Document Upload Section for PAN and Aadhaar */}
                {(verificationType.type === "pan" || verificationType.type === "aadhaar") && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Document</p>
                    <div className="flex gap-3">
                      {verificationType.type === "pan" && (
                        <IdentityDocumentCard
                          type="pan_card"
                          label="PAN Card"
                          document={getPanDocument()}
                          onUpload={() => setUploadDocType("pan_card")}
                          onView={() => {
                            const doc = getPanDocument();
                            if (doc) setPreviewDoc({ document: doc, title: "PAN Card" });
                          }}
                        />
                      )}
                      {verificationType.type === "aadhaar" && (
                        <>
                          <IdentityDocumentCard
                            type="aadhaar_front"
                            label="Aadhaar Front"
                            document={getAadhaarFrontDocument()}
                            onUpload={() => setUploadDocType("aadhaar_front")}
                            onView={() => {
                              const doc = getAadhaarFrontDocument();
                              if (doc) setPreviewDoc({ document: doc, title: "Aadhaar Card (Front)" });
                            }}
                          />
                          <IdentityDocumentCard
                            type="aadhaar_back"
                            label="Aadhaar Back"
                            document={getAadhaarBackDocument()}
                            onUpload={() => setUploadDocType("aadhaar_back")}
                            onView={() => {
                              const doc = getAadhaarBackDocument();
                              if (doc) setPreviewDoc({ document: doc, title: "Aadhaar Card (Back)" });
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Verification Details Dialog */}
      {detailsVerification && (
        <VerificationDetailsDialog
          open={true}
          onClose={() => setDetailsVerification(null)}
          verification={detailsVerification.verification}
          verificationType={detailsVerification.type}
        />
      )}
      {/* Verification Dialogs */}

      {selectedVerification?.type === "pan" && (
        <PANVerificationDialog
          open={true}
          onClose={() => setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          existingVerification={selectedVerification.data}
        />
      )}

      {selectedVerification?.type === "aadhaar" && (
        <AadhaarVerificationDialog
          open={true}
          onClose={() => setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          existingVerification={selectedVerification.data}
        />
      )}

      {selectedVerification?.type === "bank_account" && (
        <BankAccountVerificationDialog
          open={true}
          onClose={() => setSelectedVerification(null)}
          applicationId={applicationId}
          orgId={orgId}
          applicant={primaryApplicant}
          existingVerification={selectedVerification.data}
        />
      )}

      {/* VideoKYC View Dialog */}
      {videoKYCRecordingUrl && (
        <VideoKYCViewDialog
          open={videoKYCViewOpen}
          onOpenChange={setVideoKYCViewOpen}
          recordingUrl={videoKYCRecordingUrl}
          applicantName={primaryApplicant ? `${primaryApplicant.first_name || ''} ${primaryApplicant.last_name || ''}`.trim() : undefined}
          applicationId={applicationId}
          orgId={orgId}
          applicantPhone={primaryApplicant?.mobile}
          applicantEmail={primaryApplicant?.email}
        />
      )}

      {/* Identity Document Upload Dialog */}
      {uploadDocType && (
        <IdentityDocumentUploadDialog
          open={true}
          onClose={() => setUploadDocType(null)}
          applicationId={applicationId}
          orgId={orgId}
          documentType={uploadDocType}
          existingDocumentId={
            uploadDocType === "pan_card" 
              ? getPanDocument()?.id 
              : uploadDocType === "aadhaar_front"
                ? getAadhaarFrontDocument()?.id
                : getAadhaarBackDocument()?.id
          }
        />
      )}

      {/* Document Preview Dialog */}
      {previewDoc && (
        <DocumentPreviewDialog
          open={true}
          onClose={() => setPreviewDoc(null)}
          document={previewDoc.document}
          title={previewDoc.title}
        />
      )}
    </div>
  );
}
