import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface IdentityDocumentUploadDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  orgId: string;
  documentType: "pan_card" | "aadhaar_card" | "aadhaar_front" | "aadhaar_back";
  existingDocumentId?: string;
}

export function IdentityDocumentUploadDialog({
  open,
  onClose,
  applicationId,
  orgId,
  documentType,
  existingDocumentId,
}: IdentityDocumentUploadDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const documentLabel = documentType === "pan_card" 
    ? "PAN Card" 
    : documentType === "aadhaar_front" 
      ? "Aadhaar Card (Front)" 
      : documentType === "aadhaar_back" 
        ? "Aadhaar Card (Back)" 
        : "Aadhaar Card";

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Upload file to R2
      const filePath = await uploadFileToR2(file, orgId, applicationId, documentType);

      // Delete ALL old records of this document type to prevent stale data
      await supabase
        .from("loan_documents")
        .delete()
        .eq("loan_application_id", applicationId)
        .eq("document_type", documentType);

      // Insert document record
      const { error: insertError } = await supabase
        .from("loan_documents")
        .insert({
          loan_application_id: applicationId,
          document_type: documentType,
          document_category: "identity",
          file_name: file.name,
          file_path: filePath,
          mime_type: file.type,
          file_size: file.size,
          upload_status: "uploaded",
        });

      if (insertError) throw insertError;

      // Return filePath for auto-parsing
      return filePath;
    },
    onSuccess: async (filePath) => {
      // Invalidate all related caches immediately to clear stale data
      queryClient.invalidateQueries({ queryKey: ["identity-documents", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-application"] });
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });

      toast({ title: `${documentLabel} uploaded successfully` });
      onClose();

      // Auto-parse the newly uploaded document in background
      try {
        const { data: newDoc } = await supabase
          .from("loan_documents")
          .select("id, file_path")
          .eq("loan_application_id", applicationId)
          .eq("document_type", documentType)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (newDoc) {
          await supabase.functions.invoke("parse-loan-document", {
            body: { documentId: newDoc.id, documentType, filePath: newDoc.file_path },
          });
          // Refresh again after parsing completes with fresh OCR data
          queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] });
          queryClient.invalidateQueries({ queryKey: ["loan-application"] });
          queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
        }
      } catch (parseError) {
        console.error("Auto-parse failed:", parseError);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload {documentLabel}</DialogTitle>
          <DialogDescription>
            {existingDocumentId ? "Replace the existing" : "Upload a"} {documentLabel.toLowerCase()} document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
              selectedFile && "border-green-500 bg-green-50 dark:bg-green-950/20"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-10 w-10 text-green-600" />
                <p className="font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground">
                  Supports PDF, JPG, PNG
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
