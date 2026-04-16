import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadFile } from "../_shared/r2.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ESignRequest {
  org_id: string;
  application_id: string;
  document_id: string;
  document_type: "sanction_letter" | "loan_agreement" | "daily_schedule" | "combined_loan_pack";
  signer_name: string;
  signer_email?: string;
  signer_mobile: string;
  appearance?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  environment: "uat" | "production";
}

// Helper function to get a fresh token directly from Nupay API
async function getNewToken(apiEndpoint: string, apiKey: string): Promise<string> {
  const authEndpoint = `${apiEndpoint}/Auth/token`;
  console.log(`[E-Sign] Requesting fresh token from ${authEndpoint}`);

  const authResponse = await fetch(authEndpoint, {
    method: "GET",
    headers: {
      "api-key": apiKey,
    },
  });

  const authResponseText = await authResponse.text();
  console.log(`[E-Sign] Auth response status: ${authResponse.status}`);
  console.log(`[E-Sign] Auth response: ${authResponseText}`);

  if (!authResponse.ok) {
    throw new Error(`Nupay auth failed: ${authResponseText}`);
  }

  let authData;
  try {
    authData = JSON.parse(authResponseText);
  } catch {
    throw new Error(`Invalid auth response from Nupay: ${authResponseText}`);
  }

  const token = authData.token || authData.Token;

  if (!token) {
    throw new Error(`No token in Nupay response: ${JSON.stringify(authData)}`);
  }

  console.log(`[E-Sign] Got fresh token: ${token.substring(0, 20)}...`);
  return token;
}

// Helper to fetch stored PDF from Supabase Storage
// deno-lint-ignore no-explicit-any
async function getPdfFromStorage(
  supabase: SupabaseClient<any, any, any>,
  documentId: string
): Promise<Uint8Array> {
  console.log(`[E-Sign] Fetching PDF from storage for document: ${documentId}`);

  // Fetch the document record to get file_path
  const { data: docRecord, error: docError } = await supabase
    .from("loan_generated_documents")
    .select("file_path, document_type, loan_application_id")
    .eq("id", documentId)
    .single();

  if (docError || !docRecord) {
    console.error("[E-Sign] Document not found:", docError);
    throw new Error(`Document not found: ${documentId}`);
  }

  console.log(`[E-Sign] Document record:`, JSON.stringify(docRecord));

  if (!docRecord.file_path) {
    console.error("[E-Sign] Document has no file_path stored");
    throw new Error("Document has no file stored. Please regenerate the document to upload the PDF.");
  }

  // Download the PDF from R2 or Supabase Storage
  const fileData = await downloadFile(supabase, "loan-documents", docRecord.file_path);
  console.log(`[E-Sign] PDF downloaded successfully, size: ${fileData.size} bytes`);

  // Convert Blob to Uint8Array
  const arrayBuffer = await fileData.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// Fallback: Create a placeholder PDF if stored PDF not available
// deno-lint-ignore no-explicit-any
async function createFallbackPdf(
  supabase: SupabaseClient<any, any, any>,
  documentId: string,
  documentType: string,
  applicationId: string
): Promise<Uint8Array> {
  console.warn("[E-Sign] WARNING: Creating fallback placeholder PDF - stored PDF not available");
  
  const { data: application } = await supabase
    .from("loan_applications")
    .select("*, loan_sanctions(*)")
    .eq("id", applicationId)
    .single();

  if (!application) {
    throw new Error("Application not found");
  }

  // deno-lint-ignore no-explicit-any
  const appData = application as any;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  let yPosition = height - 50;

  const documentTitle = documentType === "sanction_letter" ? "SANCTION LETTER" :
    documentType === "loan_agreement" ? "LOAN AGREEMENT" :
    documentType === "combined_loan_pack" ? "COMBINED LOAN PACK" : "DAILY REPAYMENT SCHEDULE";

  page.drawText(documentTitle, {
    x: 50, y: yPosition, size: 18, font: boldFont, color: rgb(0, 0, 0),
  });
  yPosition -= 40;

  const sanction = appData.loan_sanctions?.[0];
  const lines = [
    `Application Number: ${appData.application_number || "N/A"}`,
    `Date: ${new Date().toLocaleDateString("en-IN")}`,
    "",
    `Loan Amount: Rs. ${sanction?.sanctioned_amount?.toLocaleString("en-IN") || "N/A"}`,
    `Interest Rate: ${sanction?.interest_rate || "N/A"}% p.a.`,
    `Tenure: ${sanction?.tenure_months || "N/A"} months`,
    "",
    "NOTE: This is a placeholder document.",
    "Please regenerate the Combined Loan Pack to get the full document.",
    "",
    "",
    "Signature: ___________________________",
    "",
    "(This space is reserved for digital signature)",
  ];

  for (const line of lines) {
    if (yPosition < 50) break;
    page.drawText(line, { x: 50, y: yPosition, size: 12, font: font, color: rgb(0, 0, 0) });
    yPosition -= 20;
  }

  return await pdfDoc.save();
}

// Sanitize text fields - Nupay only accepts alphanumeric and spaces
function sanitize(text: string): string {
  return text.replace(/[^a-zA-Z0-9 ]/g, "").trim();
}

// Step 1: Upload document to Nupay
async function uploadDocumentToNupay(
  apiEndpoint: string,
  apiKey: string,
  token: string,
  pdfBytes: Uint8Array,
  documentTitle: string,
  refNo: string
): Promise<{ nupayRefNo: string }> {
  const uploadEndpoint = `${apiEndpoint}/api/SignDocument/addRequestFile`;
  console.log(`[E-Sign] Step 1: Uploading document to ${uploadEndpoint}`);
  console.log(`[E-Sign] Using token: ${token.substring(0, 20)}...`);
  console.log(`[E-Sign] Ref No: ${refNo}, Document Title: ${sanitize(documentTitle)}`);

  // Create FormData for multipart upload
  const formData = new FormData();
  formData.append("document_title", sanitize(documentTitle).substring(0, 50));
  // Nupay limits remarks to 35 characters
  const shortRemarks = sanitize(`ESign ${documentTitle}`).substring(0, 35);
  formData.append("remarks", shortRemarks);
  formData.append("ref_no", refNo);
  
  // Create blob from PDF bytes
  const pdfBlob = new Blob([new Uint8Array(pdfBytes).buffer], { type: "application/pdf" });
  formData.append("document", pdfBlob, `${refNo}.pdf`);

  // Log request details before sending
  console.log(`[E-Sign] Upload request URL: ${uploadEndpoint}`);
  console.log(`[E-Sign] Upload request headers: api-key=${apiKey.substring(0, 10)}..., Token=${token.substring(0, 20)}...`);

  const uploadResponse = await fetch(uploadEndpoint, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Token": token,  // Correct per Nupay API spec (not "Authorization: Bearer")
    },
    body: formData,
  });

  const responseText = await uploadResponse.text();
  console.log(`[E-Sign] Upload response status: ${uploadResponse.status}`);
  console.log(`[E-Sign] Upload response headers:`, JSON.stringify(Object.fromEntries(uploadResponse.headers.entries())));
  console.log(`[E-Sign] Upload response body: ${responseText}`);

  let uploadData;
  try {
    uploadData = JSON.parse(responseText);
  } catch {
    console.error("[E-Sign] Failed to parse upload response:", responseText);
    throw new Error(`Invalid upload response from Nupay: ${responseText}`);
  }

  // Check for success - Nupay uses StatusCode
  const statusCode = uploadData.StatusCode || uploadData.code || uploadData.status_code;
  if (statusCode !== "NP000" && statusCode !== "200") {
    console.error("[E-Sign] Upload error:", uploadData);
    throw new Error(uploadData.StatusDesc || uploadData.message || "Document upload failed");
  }

  // Extract nupay_ref_no from response
  const nupayRefNo = uploadData.nupay_ref_no || 
                     uploadData.data?.nupay_ref_no || 
                     uploadData.NupayRefNo ||
                     uploadData.data?.NupayRefNo;

  if (!nupayRefNo) {
    console.error("[E-Sign] No nupay_ref_no in upload response:", uploadData);
    throw new Error("No reference number received from Nupay after upload");
  }

  console.log(`[E-Sign] Document uploaded successfully. Nupay Ref: ${nupayRefNo}`);
  return { nupayRefNo };
}

// Step 2: Process document for signing (add signers)
async function processForSign(
  apiEndpoint: string,
  apiKey: string,
  token: string,
  refNo: string,
  nupayRefNo: string,
  signerName: string,
  signerMobile: string,
  signerEmail: string | undefined,
  appearance: string
): Promise<{ signerUrl: string; docketId?: string; documentId?: string }> {
  const processEndpoint = `${apiEndpoint}/api/SignDocument/processForSign`;
  console.log(`[E-Sign] Step 2: Processing for sign at ${processEndpoint}`);
  console.log(`[E-Sign] Using token for Step 2: ${token.substring(0, 20)}...`);

  // Always include signer_email - Nupay requires the field to be present (even if empty)
  const signerInfo: Record<string, string> = {
    appearance: appearance,
    signer_name: signerName,
    signer_mobile: signerMobile,
    signer_email: signerEmail || "",
  };

  const payload = {
    esign_verification: {
      ref_no: refNo,
      nupay_ref_no: nupayRefNo,
      no_of_signer: 1,
      signer_info: [signerInfo],
    },
  };

  console.log(`[E-Sign] Process payload:`, JSON.stringify(payload, null, 2));
  console.log(`[E-Sign] Process request URL: ${processEndpoint}`);
  console.log(`[E-Sign] Process request headers: api-key=${apiKey.substring(0, 10)}..., Token=${token.substring(0, 20)}...`);

  const processResponse = await fetch(processEndpoint, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Token": token,  // SignDocument API uses Token header for all requests
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await processResponse.text();
  console.log(`[E-Sign] Process response status: ${processResponse.status}`);
  console.log(`[E-Sign] Process response headers:`, JSON.stringify(Object.fromEntries(processResponse.headers.entries())));
  console.log(`[E-Sign] Process response body: ${responseText}`);

  let processData;
  try {
    processData = JSON.parse(responseText);
  } catch {
    console.error("[E-Sign] Failed to parse process response:", responseText);
    throw new Error(`Invalid process response from Nupay: ${responseText}`);
  }

  // Check for success
  const statusCode = processData.StatusCode || processData.code || processData.status_code;
  if (statusCode !== "NP000" && statusCode !== "200") {
    console.error("[E-Sign] Process error:", processData);
    throw new Error(processData.StatusDesc || processData.message || "E-Sign process failed");
  }

  // Extract signer URL from response - check multiple possible locations
  // Nupay uses PascalCase "Data" and field is "url" not "signer_url"
  const signerUrl = processData.Data?.signer_info?.[0]?.url ||
                    processData.data?.signer_info?.[0]?.url ||
                    processData.Data?.signer_info?.[0]?.signer_url ||
                    processData.data?.signer_info?.[0]?.signer_url ||
                    processData.signer_url || 
                    processData.data?.signer_url ||
                    processData.SignerUrl ||
                    processData.data?.SignerUrl ||
                    processData.signer_info?.[0]?.signer_url ||
                    processData.signer_info?.[0]?.url;

  if (!signerUrl) {
    console.error("[E-Sign] No signer_url in process response:", processData);
    throw new Error("No signer URL received from Nupay");
  }

  // Nupay uses PascalCase "Data" in response
  const docketId = processData.Data?.docket_id || processData.docket_id || processData.data?.docket_id;
  const documentId = processData.Data?.document_id || processData.document_id || processData.data?.document_id;

  console.log(`[E-Sign] Process completed. Signer URL obtained.`);
  return { signerUrl, docketId, documentId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ESignRequest = await req.json();
    const {
      org_id,
      application_id,
      document_id,
      document_type,
      signer_name,
      signer_email,
      signer_mobile,
      appearance = "bottom-right",
      environment,
    } = body;

    // Validate required fields - email is optional for Nupay eSign
    if (!org_id || !application_id || !document_type || !signer_name || !signer_mobile || !environment) {
      return new Response(
        JSON.stringify({ error: "Missing required fields. Name and mobile are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[E-Sign] ========== E-SIGN REQUEST START ==========`);
    console.log(`[E-Sign] Application: ${application_id}`);
    console.log(`[E-Sign] Document Type: ${document_type}`);
    console.log(`[E-Sign] Signer: ${signer_name}, Mobile: ${signer_mobile}`);
    console.log(`[E-Sign] Environment: ${environment}`);

    // Get Nupay config (will get fresh tokens for each step)
    const { data: config, error: configError } = await supabase
      .from("nupay_config")
      .select("*")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      throw new Error("Nupay configuration not found or inactive");
    }

    const configData = config as { api_endpoint: string; api_key: string; esign_api_endpoint?: string; esign_api_key?: string };
    // Use esign_api_endpoint if available, otherwise fall back to api_endpoint
    const apiEndpoint = configData.esign_api_endpoint || configData.api_endpoint;
    // Use esign_api_key if available (for separate eSign credentials), otherwise fall back to api_key
    const apiKey = configData.esign_api_key || configData.api_key;
    console.log(`[E-Sign] Using API endpoint: ${apiEndpoint}`);
    console.log(`[E-Sign] Using ${configData.esign_api_key ? 'separate eSign API key' : 'shared API key'}`);

    // Fetch stored PDF from storage (or create fallback if not available)
    console.log("[E-Sign] Fetching PDF document from storage...");
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await getPdfFromStorage(supabase, document_id);
      console.log(`[E-Sign] PDF fetched from storage, size: ${pdfBytes.length} bytes`);
    } catch (storageError) {
      console.warn(`[E-Sign] Storage fetch failed: ${storageError}. Using fallback placeholder.`);
      pdfBytes = await createFallbackPdf(supabase, document_id, document_type, application_id);
      console.log(`[E-Sign] Fallback PDF created, size: ${pdfBytes.length} bytes`);
    }

    // Generate reference number (max 20 chars for Nupay, alphanumeric only)
    const refNo = `ES${Date.now().toString(36).toUpperCase()}`;
    const documentTitle = document_type === "sanction_letter" ? "Sanction Letter" :
      document_type === "loan_agreement" ? "Loan Agreement" :
      document_type === "combined_loan_pack" ? "Combined Loan Pack" : "Daily Repayment Schedule";

    console.log(`[E-Sign] Generated ref_no: ${refNo}`);

    // Get single token for the entire eSign session (Nupay requires same token for upload + process)
    console.log("[E-Sign] Getting token for eSign session...");
    const token = await getNewToken(apiEndpoint, apiKey);

    // Step 1: Upload document to Nupay
    const { nupayRefNo } = await uploadDocumentToNupay(
      apiEndpoint,
      apiKey,
      token,
      pdfBytes,
      documentTitle,
      refNo
    );

    // Step 2: Process for signing - get FRESH token (Nupay invalidates token after upload)
    console.log("[E-Sign] Step 2: Waiting 2 seconds then getting fresh token...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const token2 = await getNewToken(apiEndpoint, apiKey);
    console.log(`[E-Sign] Step 2: Fresh token obtained: ${token2.substring(0, 20)}...`);
    
    if (token === token2) {
      console.warn("[E-Sign] WARNING: Tokens are identical - extending wait time");
      await new Promise(resolve => setTimeout(resolve, 3000));
      const token3 = await getNewToken(apiEndpoint, apiKey);
      console.log(`[E-Sign] Step 2: Third attempt token: ${token3.substring(0, 20)}...`);
    }
    
    const finalToken = token === token2 ? await getNewToken(apiEndpoint, apiKey) : token2;
    
    const { signerUrl, docketId, documentId: nupayDocumentId } = await processForSign(
      apiEndpoint,
      apiKey,
      finalToken,  // Use fresh token for Step 2
      refNo,
      nupayRefNo,
      signer_name,
      signer_mobile,
      signer_email,
      appearance
    );

    // Generate access token for our record
    const accessToken = crypto.randomUUID();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 72); // 72 hour expiry

    // Create e-sign request record
    const { data: esignRecord, error: insertError } = await supabase
      .from("document_esign_requests")
      .insert({
        org_id,
        application_id,
        document_id,
        document_type,
        signer_name,
        signer_phone: signer_mobile,
        signer_email: signer_email || null,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        status: "sent",
        nupay_docket_id: docketId,
        nupay_document_id: nupayDocumentId,
        nupay_ref_no: nupayRefNo,
        signer_url: signerUrl,
        esign_response: { nupayRefNo, docketId, documentId: nupayDocumentId },
        notification_sent_at: new Date().toISOString(),
        audit_log: [{
          action: "esign_initiated",
          timestamp: new Date().toISOString(),
          details: { environment, appearance, refNo, nupayRefNo },
        }],
      })
      .select()
      .single();

    if (insertError) {
      console.error("[E-Sign] Failed to save record:", insertError);
      throw new Error(`Failed to save e-sign request: ${insertError.message}`);
    }

    console.log(`[E-Sign] Request created successfully: ${esignRecord.id}`);

    // Send notifications (WhatsApp and Email)
    const channels: string[] = ["whatsapp"];
    if (signer_email) {
      channels.push("email");
    }

    console.log(`[E-Sign] Sending notifications via: ${channels.join(", ")}`);
    
    try {
      const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/send-esign-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          org_id,
          signer_name,
          signer_email,
          signer_mobile,
          signer_url: signerUrl,
          document_type,
          application_id,
          channels,
        }),
      });

      const notifyResult = await notifyResponse.json();
      console.log(`[E-Sign] Notification results:`, JSON.stringify(notifyResult, null, 2));

      // Update the record with notification channel
      const sentChannels = notifyResult.results
        ?.filter((r: { success: boolean }) => r.success)
        .map((r: { channel: string }) => r.channel)
        .join(",") || null;

      if (sentChannels) {
        await supabase
          .from("document_esign_requests")
          .update({ notification_channel: sentChannels })
          .eq("id", esignRecord.id);
      }
    } catch (notifyError) {
      console.error("[E-Sign] Notification error (non-fatal):", notifyError);
      // Don't fail the whole request if notifications fail
    }

    console.log(`[E-Sign] ========== E-SIGN REQUEST SUCCESS ==========`);

    return new Response(
      JSON.stringify({
        success: true,
        esign_request_id: esignRecord.id,
        signer_url: signerUrl,
        nupay_document_id: nupayDocumentId,
        nupay_ref_no: nupayRefNo,
        ref_no: refNo,
        expires_at: tokenExpiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[E-Sign] ========== E-SIGN REQUEST FAILED ==========");
    console.error("[E-Sign] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});