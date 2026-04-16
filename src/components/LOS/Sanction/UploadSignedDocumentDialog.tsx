import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadSignedDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  sanctionId: string;
  orgId: string;
  documentType?: string;
  onSuccess: () => void;
}

export default function UploadSignedDocumentDialog({
  open,
  onOpenChange,
  applicationId,
  sanctionId,
  orgId,
  documentType: initialDocType,
  onSuccess,
}: UploadSignedDocumentDialogProps) {
  const [documentType, setDocumentType] = useState<string>(initialDocType || "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Update documentType when initialDocType changes
  useEffect(() => {
    if (initialDocType) {
      setDocumentType(initialDocType);
    }
  }, [initialDocType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Please upload a PDF or image file");
        return;
      }
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !documentType) {
      toast.error("Please select document type and file");
      return;
    }

    setUploading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("application_id", applicationId);
      formData.append("org_id", orgId);
      formData.append("sanction_id", sanctionId);
      formData.append("document_type", documentType);

      const response = await fetch(`${supabaseUrl}/functions/v1/upload-signed-document`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": supabaseAnonKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }

      toast.success("Signed document uploaded successfully");
      onSuccess();
      onOpenChange(false);
      setFile(null);
      if (!initialDocType) {
        setDocumentType("");
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const docTypeLabel = documentType === 'sanction_letter' ? 'Sanction Letter' : 
                      documentType === 'loan_agreement' ? 'Loan Agreement' : 
                      documentType === 'combined_loan_pack' ? 'Combined Loan Pack' :
                      documentType === 'daily_schedule' ? 'Daily Repayment Schedule' : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Upload Signed {docTypeLabel || 'Document'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!initialDocType && (
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sanction_letter">Sanction Letter</SelectItem>
                  <SelectItem value="loan_agreement">Loan Agreement</SelectItem>
                  <SelectItem value="combined_loan_pack">Combined Loan Pack</SelectItem>
                  <SelectItem value="daily_schedule">Daily Repayment Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Signed Document</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
                id="signed-doc-upload"
              />
              <label
                htmlFor="signed-doc-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {file ? file.name : "Click to upload PDF or Image"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Max file size: 10MB
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!file || !documentType || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
