import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle, AlertCircle, FileText, X, Clock } from "lucide-react";

const REQUIRED_DOCUMENTS = [
  { type: "pan_card", name: "PAN Card", category: "identity", mandatory: true },
  { type: "aadhaar_front", name: "Aadhaar Card (Front)", category: "identity", mandatory: true },
  { type: "aadhaar_back", name: "Aadhaar Card (Back)", category: "identity", mandatory: false },
  { type: "photo", name: "Passport Photo", category: "identity", mandatory: true },
  { type: "salary_slip_1", name: "Salary Slip - Month 1", category: "income", mandatory: true },
  { type: "salary_slip_2", name: "Salary Slip - Month 2", category: "income", mandatory: true },
  { type: "salary_slip_3", name: "Salary Slip - Month 3", category: "income", mandatory: true },
  { type: "bank_statement", name: "Bank Statement (6 months)", category: "bank", mandatory: true },
  { type: "offer_letter", name: "Offer Letter", category: "employment", mandatory: true },
  { type: "rental_agreement", name: "Rental Agreement", category: "address", mandatory: true },
  { type: "utility_bill", name: "Utility Bill", category: "address", mandatory: true },
];

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identity Proof",
  income: "Income Proof",
  bank: "Bank Statements",
  employment: "Employment Proof",
  address: "Address Proof",
};

const CATEGORY_ORDER = ["identity", "income", "bank", "employment", "address"];

type PageState = "loading" | "ready" | "error" | "expired" | "completed";

interface UploadedDoc {
  id: string;
  document_type: string;
  document_category: string;
  file_name: string;
  upload_status: string;
  parsing_status: string;
}

export default function PublicDocumentUpload() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("validate-document-upload-token", {
        body: { token },
      });

      if (error) throw error;

      if (!data.valid) {
        if (data.status === "expired") {
          setPageState("expired");
        } else if (data.status === "completed") {
          setCompletedAt(data.completed_at);
          setPageState("completed");
        } else {
          setErrorMessage(data.error || "Invalid link");
          setPageState("error");
        }
        return;
      }

      setApplicantName(data.applicant_name || "");
      setApplicationId(data.application_id);
      setOrgId(data.org_id);
      setUploadedDocs(data.existing_documents || []);
      setPageState("ready");
    } catch (err: any) {
      setErrorMessage(err.message || "Something went wrong");
      setPageState("error");
    }
  };

  const isDocUploaded = (docType: string) => {
    return uploadedDocs.some(d => d.document_type === docType && d.upload_status === "uploaded");
  };

  const getDocStatus = (docType: string) => {
    const doc = uploadedDocs.find(d => d.document_type === docType);
    if (!doc) return null;
    return doc;
  };

  const handleFileUpload = async (docType: string, category: string, file: File) => {
    setUploadingType(docType);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co";

      const formData = new FormData();
      formData.append("token", token!);
      formData.append("document_type", docType);
      formData.append("document_category", category);
      formData.append("file", file);

      const response = await fetch(`${supabaseUrl}/functions/v1/public-document-upload`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Upload failed");
      }

      // Add to uploaded docs
      setUploadedDocs(prev => {
        const filtered = prev.filter(d => d.document_type !== docType);
        return [...filtered, {
          id: result.document_id,
          document_type: docType,
          document_category: category,
          file_name: result.file_name,
          upload_status: "uploaded",
          parsing_status: "processing",
        }];
      });
    } catch (err: any) {
      alert(err.message || "Failed to upload file. Please try again.");
    } finally {
      setUploadingType(null);
    }
  };

  const handleFileSelect = (docType: string, category: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit. Please choose a smaller file.");
      return;
    }

    handleFileUpload(docType, category, file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const mandatoryCount = REQUIRED_DOCUMENTS.filter(d => d.mandatory).length;
  const uploadedMandatoryCount = REQUIRED_DOCUMENTS.filter(
    d => d.mandatory && isDocUploaded(d.type)
  ).length;
  const allMandatoryUploaded = uploadedMandatoryCount === mandatoryCount;

  // Group documents by category
  const groupedDocs = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    documents: REQUIRED_DOCUMENTS.filter(d => d.category === cat),
  }));

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verifying your link...</p>
        </div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Clock className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-semibold">Link Expired</h2>
            <p className="text-muted-foreground">
              This document upload link has expired. Please contact your loan officer for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold">Documents Already Submitted</h2>
            <p className="text-muted-foreground">
              Your documents have already been submitted
              {completedAt && ` on ${new Date(completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Document Upload</h1>
          {applicantName && (
            <p className="text-muted-foreground">
              Hello {applicantName}, please upload the required documents for your loan application.
            </p>
          )}
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant={allMandatoryUploaded ? "default" : "secondary"}>
              {uploadedMandatoryCount}/{mandatoryCount} mandatory uploaded
            </Badge>
          </div>
        </div>

        {/* Document Categories */}
        {groupedDocs.map(group => (
          <Card key={group.category}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {group.documents.map(doc => {
                const uploaded = isDocUploaded(doc.type);
                const docStatus = getDocStatus(doc.type);
                const isUploading = uploadingType === doc.type;

                return (
                  <div
                    key={doc.type}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      uploaded ? "bg-green-50 border-green-200" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {uploaded ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {doc.name}
                          {doc.mandatory && <span className="text-destructive ml-1">*</span>}
                        </p>
                        {uploaded && docStatus?.file_name && (
                          <p className="text-xs text-muted-foreground truncate">{docStatus.file_name}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0 ml-2">
                      <input
                        ref={el => { fileInputRefs.current[doc.type] = el; }}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileSelect(doc.type, doc.category)}
                        className="hidden"
                      />
                      <Button
                        variant={uploaded ? "outline" : "default"}
                        size="sm"
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[doc.type]?.click()}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Uploading...
                          </>
                        ) : uploaded ? (
                          "Re-upload"
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        {/* Success Banner */}
        {allMandatoryUploaded && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center space-y-2">
              <CheckCircle className="h-10 w-10 mx-auto text-green-600" />
              <h3 className="text-lg font-semibold text-green-800">All mandatory documents uploaded!</h3>
              <p className="text-sm text-green-700">
                Thank you. Your documents are being processed. You may close this page or upload additional documents.
              </p>
            </CardContent>
          </Card>
        )}

        {/* File format note */}
        <p className="text-xs text-center text-muted-foreground">
          Accepted formats: PDF, JPEG, PNG, WebP. Maximum file size: 10MB.
        </p>
      </div>
    </div>
  );
}
