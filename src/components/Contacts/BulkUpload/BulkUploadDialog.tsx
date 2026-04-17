import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";
import { logError } from "@/lib/errorLogger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RECORDS = 5000;

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onUploadStarted: () => void;
}

export function BulkUploadDialog({ open, onOpenChange, orgId, onUploadStarted }: BulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<string>("");
  const notification = useNotification();

  // Error logging helper
  const logUploadError = async (step: string, error: any, details?: any) => {
    const timestamp = new Date().toISOString();
    const errorData = {
      step,
      timestamp,
      error: error?.message || String(error),
      details,
      file_name: file?.name,
      file_size: file?.size,
      stack: error?.stack
    };
    
    console.error(`[UPLOAD-${step}]`, errorData);
    
    try {
      await logError(new Error(`Bulk Upload Error: ${step}`), errorData);
    } catch (e) {
      console.error('[LOG-ERROR]', e);
    }
  };

  const validateFile = (file: File): string | null => {
    console.log('[FILE-VALIDATION-START]', { name: file.name, size: file.size, type: file.type });
    
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      const error = 'Please select a CSV file';
      console.error('[FILE-VALIDATION-FAILED]', { reason: 'invalid_type', file_type: file.type });
      return error;
    }

    if (file.size > 10 * 1024 * 1024) {
      const error = 'File size must be less than 10MB';
      console.error('[FILE-VALIDATION-FAILED]', { reason: 'file_too_large', size: file.size });
      return error;
    }

    console.log('[FILE-VALIDATION-SUCCESS]', { name: file.name, size: file.size });
    return null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const error = validateFile(droppedFile);
      if (error) {
        setValidationError(error);
        setFile(null);
      } else {
        setValidationError("");
        setFile(droppedFile);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        setValidationError(error);
        setFile(null);
      } else {
        setValidationError("");
        setFile(selectedFile);
      }
    }
  };

  const downloadTemplate = () => {
    const headers = ['first_name', 'last_name', 'email', 'phone', 'company', 'job_title', 'status', 'source'];
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    notification.info("Template Downloaded", "Use this template to format your contacts CSV file.");
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);

    try {
      // Read and validate CSV
      const text = await file.text();
      const lines = text.trim().split('\n');
      
      // Check record count
      const recordCount = lines.length - 1; // Subtract header
      if (recordCount > MAX_RECORDS) {
        setValidationError(`File contains ${recordCount} records. Maximum allowed is ${MAX_RECORDS}`);
        setIsUploading(false);
        return;
      }

      // Check for email column
      const headers = lines[0].toLowerCase();
      if (!headers.includes('email')) {
        setValidationError("CSV must contain an 'email' column");
        setIsUploading(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get presigned R2 upload URL
      const r2Key = `bulk-imports/${orgId}/${Date.now()}-${file.name}`;
      const { data: urlData, error: urlError } = await supabase.functions.invoke('generate-upload-url', {
        body: { key: r2Key, contentType: 'text/csv' },
      });
      if (urlError || !urlData?.uploadUrl) {
        throw new Error(`Failed to get upload URL: ${urlError?.message}`);
      }

      // Upload directly to R2 via presigned URL
      const uploadResp = await fetch(urlData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/csv' },
        body: file,
      });
      if (!uploadResp.ok) {
        throw new Error(`Failed to upload file: ${uploadResp.status} ${uploadResp.statusText}`);
      }

      const filePath = urlData.publicUrl;

      // Verify user profile has org_id
      console.log('[PROFILE-VERIFY-START]', { userId: user.id });
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id, is_active')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('[PROFILE-VERIFY-FAILED]', profileError);
        await logUploadError('profile_verification', profileError, { userId: user.id });
        throw new Error('Failed to verify profile. Please contact support.');
      }

      if (!profile?.org_id) {
        console.error('[PROFILE-VERIFY-FAILED]', { reason: 'missing_org_id', userId: user.id });
        await logUploadError('profile_verification', new Error('Missing org_id'), { userId: user.id });
        throw new Error('Profile setup incomplete. Please contact support.');
      }

      if (!profile.is_active) {
        console.error('[PROFILE-VERIFY-FAILED]', { reason: 'inactive_profile', userId: user.id });
        await logUploadError('profile_verification', new Error('Inactive profile'), { userId: user.id });
        throw new Error('Your account is not active. Please contact support.');
      }
      
      console.log('[PROFILE-VERIFY-SUCCESS]', { userId: user.id, orgId: profile.org_id });

      // Create import job
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          org_id: orgId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          import_type: 'contacts',
          status: 'pending',
          total_rows: recordCount,
          current_stage: 'uploaded'
        })
        .select()
        .single();

      if (jobError) {
        console.error('Job creation error:', jobError);
        
        // Provide more specific error messages
        if (jobError.code === '42501') {
          throw new Error('Permission denied. Please ensure your profile is set up correctly.');
        } else if (jobError.message?.includes('violates row-level security')) {
          throw new Error('Access denied. Please verify your organization membership.');
        }
        
        throw new Error(`Failed to create import job: ${jobError.message}`);
      }

      // Trigger background processing
      const { error: triggerError } = await supabase.functions.invoke('bulk-import-trigger', {
        body: { importJobId: job.id }
      });

      if (triggerError) throw triggerError;

      notification.success("Upload started", "Your file is being processed in the background");
      onUploadStarted();
      onOpenChange(false);
      setFile(null);
    } catch (error: any) {
      console.error('Upload error:', error);
      notification.error("Upload failed", error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFile(null);
      setValidationError("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Upload Contacts</DialogTitle>
          <DialogDescription>
            Upload a CSV file with contact information. Maximum 5,000 records and 10MB file size.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
        </div>

        <div className="space-y-4">
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="space-y-2">
                <FileText className="h-12 w-12 mx-auto text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setValidationError("");
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop your CSV file here, or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
              </div>
            )}
          </div>

          <div className="bg-muted p-3 rounded-lg text-xs space-y-1">
            <p className="font-medium">Requirements:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>UTF-8 encoded CSV file</li>
              <li>Required column: <code className="bg-background px-1 rounded">email</code></li>
              <li>Maximum 5,000 records per upload</li>
              <li>Maximum file size: 10MB</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || isUploading}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
