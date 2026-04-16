import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabaseClient.ts";
import { uploadToR2 } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const applicationId = formData.get("application_id") as string | null;
    const orgId = formData.get("org_id") as string | null;
    const sanctionId = formData.get("sanction_id") as string | null;
    const documentType = formData.get("document_type") as string | null;

    if (!file || !applicationId || !orgId || !documentType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileExt = file.name.split(".").pop() || "pdf";
    const r2Key = `loan-docs/${orgId}/${applicationId}/signed/${documentType}_${Date.now()}.${fileExt}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const fileUrl = await uploadToR2(r2Key, bytes, file.type || "application/pdf");

    const { error: updateError } = await supabase
      .from("loan_generated_documents")
      .update({
        signed_document_path: fileUrl,
        customer_signed: true,
        signed_at: new Date().toISOString(),
        status: "signed",
        ...(sanctionId ? { sanction_id: sanctionId } : {}),
      })
      .eq("loan_application_id", applicationId)
      .eq("document_type", documentType);

    if (updateError) throw updateError;

    // Check if all documents are signed and update sanction status
    if (sanctionId) {
      const { data: docs } = await supabase
        .from("loan_generated_documents")
        .select("customer_signed")
        .eq("loan_application_id", applicationId);

      if (docs?.every((d) => d.customer_signed)) {
        await supabase
          .from("loan_sanctions")
          .update({ status: "signed", customer_accepted: true, accepted_at: new Date().toISOString() })
          .eq("id", sanctionId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, file_url: fileUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("[upload-signed-document] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Upload failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
