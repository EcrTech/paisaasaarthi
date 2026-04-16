import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2 } from "lucide-react";

interface DocumentPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  document: {
    file_path: string;
    file_name?: string;
    file_type?: string;
    mime_type?: string;
  } | null;
  title: string;
}

export function DocumentPreviewDialog({
  open,
  onClose,
  document,
  title,
}: DocumentPreviewDialogProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const mimeType = document?.mime_type || document?.file_type || "";
  const filePath = document?.file_path || "";

  const isImage = mimeType.startsWith("image/") || 
    /\.(jpg|jpeg|png|gif|webp)$/i.test(filePath);

  const isPdf = mimeType === "application/pdf" || 
    filePath.endsWith(".pdf");

  useEffect(() => {
    if (open && filePath) {
      setLoading(true);
      setSignedUrl(null);

      if (filePath.startsWith("https://")) {
        setSignedUrl(filePath);
        setLoading(false);
      } else {
        supabase.storage
          .from("loan-documents")
          .createSignedUrl(filePath, 3600)
          .then(({ data, error }) => {
            if (data && !error) setSignedUrl(data.signedUrl);
            setLoading(false);
          });
      }
    } else {
      setSignedUrl(null);
      setLoading(false);
    }
  }, [open, filePath]);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : signedUrl ? (
            <>
              {isImage ? (
                <img
                  src={signedUrl}
                  alt={title}
                  className="max-h-[60vh] object-contain rounded-lg border"
                />
              ) : isPdf ? (
                <div className="w-full h-[60vh] border rounded-lg overflow-hidden">
                  <embed
                    src={signedUrl + "#toolbar=1&navpanes=0"}
                    type="application/pdf"
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <p className="text-muted-foreground">
                    Preview not available for this file type
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={signedUrl} download={document?.file_name || "document"}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Unable to load document</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
