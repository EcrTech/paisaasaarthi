import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToR2 } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WebhookPayload {
  document_id?: string;
  docket_id?: string;
  ref_no?: string;
  status?: string;
  signer_info?: Array<{
    name?: string;
    mobile?: string;
    status?: string;
    signed_at?: string;
  }>;
  signed_document?: string; // Base64 signed PDF
  event_type?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const payload: WebhookPayload = await req.json();
    console.log("[E-Sign-Webhook] Received payload:", JSON.stringify(payload, null, 2));

    const documentId = payload.document_id;
    const refNo = payload.ref_no;
    const docketId = payload.docket_id;

    if (!documentId && !refNo && !docketId) {
      console.error("[E-Sign-Webhook] No identifier in payload");
      return new Response(
        JSON.stringify({ error: "No document identifier provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the e-sign request
    let query = supabase.from("document_esign_requests").select("*");
    
    if (documentId) {
      query = query.eq("nupay_document_id", documentId);
    } else if (refNo) {
      query = query.eq("nupay_ref_no", refNo);
    } else if (docketId) {
      query = query.eq("nupay_docket_id", docketId);
    }

    const { data: esignRecord, error: fetchError } = await query.single();

    if (fetchError || !esignRecord) {
      console.error("[E-Sign-Webhook] Record not found for:", { documentId, refNo, docketId });
      return new Response(
        JSON.stringify({ error: "E-sign request not found", received: { documentId, refNo, docketId } }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[E-Sign-Webhook] Found record: ${esignRecord.id}`);

    // Determine new status
    const signerStatus = payload.signer_info?.[0]?.status || payload.status;
    let newStatus = esignRecord.status;
    let signedAt = null;
    let signedDocumentPath = null;

    if (signerStatus === "signed" || signerStatus === "completed" || payload.event_type === "document_signed") {
      newStatus = "signed";
      signedAt = payload.signer_info?.[0]?.signed_at || new Date().toISOString();

      // If signed document is provided, store it
      if (payload.signed_document) {
        try {
          // Decode base64 and upload to storage
          const binaryStr = atob(payload.signed_document);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const r2Key = `loan-docs/esign/${esignRecord.org_id}/${esignRecord.application_id}/${esignRecord.document_type}-signed-${Date.now()}.pdf`;
          try {
            signedDocumentPath = await uploadToR2(r2Key, bytes, "application/pdf");
            console.log(`[E-Sign-Webhook] Signed document saved to R2: ${r2Key}`);
          } catch (r2Err) {
            console.error("[E-Sign-Webhook] R2 upload failed:", r2Err);
          }
        } catch (uploadErr) {
          console.error("[E-Sign-Webhook] Error processing signed document:", uploadErr);
        }
      }
    } else if (signerStatus === "expired") {
      newStatus = "expired";
    } else if (signerStatus === "failed" || signerStatus === "rejected") {
      newStatus = "failed";
    } else if (signerStatus === "viewed") {
      newStatus = "viewed";
    }

    // Update audit log
    const auditLog = Array.isArray(esignRecord.audit_log) ? esignRecord.audit_log : [];
    auditLog.push({
      action: "webhook_received",
      timestamp: new Date().toISOString(),
      payload_status: signerStatus,
      event_type: payload.event_type,
      new_status: newStatus,
    });

    // Update e-sign request record
    const updateData: Record<string, unknown> = {
      status: newStatus,
      audit_log: auditLog,
      esign_response: payload,
      updated_at: new Date().toISOString(),
    };

    if (signedAt) {
      updateData.signed_at = signedAt;
    }

    if (signedDocumentPath) {
      updateData.signed_document_path = signedDocumentPath;
    }

    const { error: updateError } = await supabase
      .from("document_esign_requests")
      .update(updateData)
      .eq("id", esignRecord.id);

    if (updateError) {
      console.error("[E-Sign-Webhook] Failed to update record:", updateError);
    }

    // If signed, also update loan_generated_documents
    if (newStatus === "signed" && esignRecord.document_id) {
      const docUpdateData: Record<string, unknown> = {
        customer_signed: true,
        signed_at: signedAt,
        status: "signed",
      };

      if (signedDocumentPath) {
        docUpdateData.signed_document_path = signedDocumentPath;
      }

      await supabase
        .from("loan_generated_documents")
        .update(docUpdateData)
        .eq("id", esignRecord.document_id);

      console.log(`[E-Sign-Webhook] Updated document ${esignRecord.document_id} as signed`);
    }

    console.log(`[E-Sign-Webhook] Record updated: ${esignRecord.id} -> ${newStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed",
        esign_request_id: esignRecord.id,
        new_status: newStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[E-Sign-Webhook] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
