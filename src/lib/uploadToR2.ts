import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a file to Cloudflare R2 via the staff-document-upload edge function.
 * Returns the public R2 URL.
 */
export async function uploadFileToR2(
  file: File,
  orgId: string,
  applicationId: string,
  folder: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("org_id", orgId);
  formData.append("application_id", applicationId);
  formData.append("folder", folder);

  const { data, error } = await supabase.functions.invoke("staff-document-upload", {
    body: formData,
  });

  if (error) throw new Error(error.message || "Upload failed");
  if (!data?.success) throw new Error(data?.error || "Upload failed");
  return data.url as string;
}
