import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Image, Video } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export interface Attachment {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  size?: number;
}

interface AttachmentManagerProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  orgId: string;
}

export const AttachmentManager = ({ attachments, onChange, orgId }: AttachmentManagerProps) => {
  const [uploading, setUploading] = useState(false);
  const notify = useNotification();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileSize = file.size;
    const totalSize = attachments.reduce((sum, att) => sum + (att.size || 0), 0);

    // Check file size limits
    if (fileSize > 5 * 1024 * 1024) {
      notify.error("File too large", new Error("Maximum file size is 5MB per file"));
      return;
    }

    if (totalSize + fileSize > 10 * 1024 * 1024) {
      notify.error("Total size exceeded", new Error("Total attachments size cannot exceed 10MB"));
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const r2Key = `email-attachments/${orgId}/${crypto.randomUUID()}.${fileExt}`;

      const { data: urlData, error: urlError } = await supabase.functions.invoke('generate-upload-url', {
        body: { key: r2Key, contentType: file.type },
      });
      if (urlError || !urlData?.uploadUrl) throw new Error(urlError?.message || 'Failed to get upload URL');

      const uploadResp = await fetch(urlData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResp.ok) throw new Error(`Upload failed: ${uploadResp.status}`);

      const publicUrl = urlData.publicUrl;

      const fileType = file.type.startsWith('video/') ? 'video' : 'image';

      const newAttachment: Attachment = {
        id: crypto.randomUUID(),
        type: fileType,
        url: publicUrl,
        name: file.name,
        size: fileSize,
      };

      onChange([...attachments, newAttachment]);

      notify.success("File uploaded", `${file.name} has been uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      notify.error("Upload failed", new Error("Failed to upload file. Please try again."));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeAttachment = (attachment: Attachment) => {
    onChange(attachments.filter(att => att.id !== attachment.id));
    notify.success("Attachment removed", `${attachment.name} has been removed`);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Attachments (Images & Videos)</Label>
        <div className="text-xs text-muted-foreground">
          Max 5MB per file, 10MB total
        </div>
      </div>

      <div>
        <input
          type="file"
          id="attachment-upload"
          className="hidden"
          accept="image/jpeg,image/png,image/gif,video/mp4,video/webm"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById('attachment-upload')?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : 'Upload File'}
        </Button>
      </div>

      <div className="space-y-2">
        {attachments.map((attachment) => (
          <Card key={attachment.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {attachment.type === 'image' ? (
                    <Image className="h-8 w-8 text-blue-500" />
                  ) : (
                    <Video className="h-8 w-8 text-purple-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {attachment.type.toUpperCase()} · {formatFileSize(attachment.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(attachment)}
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {attachments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No attachments added. Upload images or videos to include in your email.
        </p>
      )}
    </div>
  );
};
