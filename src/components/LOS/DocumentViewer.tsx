import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingState } from "@/components/common/LoadingState";
import { FileText, Download, Eye, Image, File, CheckCircle, XCircle, Clock } from "lucide-react";

interface DocumentViewerProps {
  applicationId: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  pan_card: "PAN Card",
  aadhaar_card: "Aadhaar Card",
  salary_slip: "Salary Slip",
  bank_statement: "Bank Statement",
  address_proof: "Address Proof",
  photo: "Photograph",
  signature: "Signature",
  rental_agreement: "Rental Agreement",
  utility_bill: "Utility Bill",
  other: "Other Document",
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock className="h-3 w-3" />, color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", label: "Pending" },
  verified: { icon: <CheckCircle className="h-3 w-3" />, color: "bg-green-500/10 text-green-600 border-green-500/20", label: "Verified" },
  rejected: { icon: <XCircle className="h-3 w-3" />, color: "bg-red-500/10 text-red-600 border-red-500/20", label: "Rejected" },
};

export default function DocumentViewer({ applicationId }: DocumentViewerProps) {
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["loan-documents-viewer", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_documents")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const resolveUrl = async (filePath: string, expiry: number): Promise<string | null> => {
    if (filePath.startsWith("https://")) return filePath;
    const { data } = await supabase.storage.from("loan-documents").createSignedUrl(filePath, expiry);
    return data?.signedUrl ?? null;
  };

  const handleView = async (doc: any) => {
    try {
      const url = await resolveUrl(doc.file_path, 3600);
      if (url) {
        if (isPdfFile(doc.file_name)) {
          window.open(url, "_blank");
        } else {
          setPreviewUrl(url);
          setSelectedDoc(doc);
        }
      }
    } catch (err) {
      console.error("Error getting document URL:", err);
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const url = await resolveUrl(doc.file_path, 300);
      if (url) {
        const link = document.createElement("a");
        link.href = url;
        link.download = doc.file_name;
        link.click();
      }
    } catch (err) {
      console.error("Error downloading:", err);
    }
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
  };

  const isPdfFile = (fileName: string) => {
    return fileName.toLowerCase().endsWith(".pdf");
  };

  if (isLoading) {
    return <LoadingState message="Loading documents..." />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Uploaded Documents
          </CardTitle>
          <CardDescription>
            {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <File className="mx-auto h-12 w-12 mb-4" />
              <p>No documents uploaded yet</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc: any) => {
                const status = STATUS_CONFIG[doc.verification_status] || STATUS_CONFIG.pending;
                const isImage = isImageFile(doc.file_name);

                return (
                  <div
                    key={doc.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                  >
                    {/* Document Icon/Preview */}
                    <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                      {isImage ? (
                        <Image className="h-12 w-12 text-muted-foreground" />
                      ) : (
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>

                    {/* Document Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">
                          {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                        </h4>
                        <Badge variant="outline" className={status.color}>
                          {status.icon}
                          <span className="ml-1">{status.label}</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleView(doc)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {DOCUMENT_TYPE_LABELS[selectedDoc?.document_type] || "Document"} - {selectedDoc?.file_name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewUrl && selectedDoc && (
              <>
                {isImageFile(selectedDoc.file_name) ? (
                  <img
                    src={previewUrl}
                    alt={selectedDoc.file_name}
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : isPdfFile(selectedDoc.file_name) ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] rounded-lg border"
                    title={selectedDoc.file_name}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Preview not available for this file type
                    </p>
                    <Button onClick={() => handleDownload(selectedDoc)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download to View
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}