import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateMandateRequest {
  org_id: string;
  environment: "uat" | "production";
  loan_application_id: string;
  contact_id?: string;
  
  // Mandate details
  loan_no: string;
  seq_type: "RCUR" | "OOFF";
  frequency: "ADHO" | "INDA" | "DAIL" | "WEEK" | "MNTH" | "QURT" | "MIAN" | "YEAR" | "BIMN";
  category_id?: number;
  
  // Amount
  collection_amount: number;
  debit_type?: boolean;
  
  // Dates
  first_collection_date: string;
  final_collection_date?: string;
  collection_until_cancel?: boolean;
  
  // Bank account
  account_holder_name: string;
  bank_account_no: string;
  bank_account_no_confirmation: string;
  ifsc_code?: string;
  bank_id: number;
  bank_name?: string;
  account_type: "Savings" | "Current" | "OTHER";
  auth_type?: "NetBanking" | "DebitCard" | "Aadhaar" | "";
  
  // Contact
  mobile_no: string;
  email?: string;
  
  // Additional fields
  additional_data?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      console.error("[Nupay-CreateMandate] Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Session expired or invalid. Please log in again.", code: "SESSION_EXPIRED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData: CreateMandateRequest = await req.json();

    // Validate required fields
    const requiredFields = [
      "org_id", "environment", "loan_application_id", "loan_no",
      "seq_type", "frequency", "collection_amount", "first_collection_date",
      "account_holder_name", "bank_account_no", "bank_account_no_confirmation",
      "bank_id", "account_type", "mobile_no"
    ];

    for (const field of requiredFields) {
      if (!requestData[field as keyof CreateMandateRequest]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verify account numbers match
    if (requestData.bank_account_no !== requestData.bank_account_no_confirmation) {
      return new Response(
        JSON.stringify({ error: "Account numbers do not match" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth token
    const authFunctionUrl = `${supabaseUrl}/functions/v1/nupay-authenticate`;
    const tokenResponse = await fetch(authFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ org_id: requestData.org_id, environment: requestData.environment }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      return new Response(
        JSON.stringify({ error: "Failed to authenticate", details: errorData }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token } = await tokenResponse.json();

    // Fetch Nupay config
    console.log(`[Nupay-CreateMandate] Looking up config for org_id=${requestData.org_id}, environment=${requestData.environment}`);
    const { data: config } = await supabase
      .from("nupay_config")
      .select("*")
      .eq("org_id", requestData.org_id)
      .eq("environment", requestData.environment)
      .eq("is_active", true)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Nupay configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize input values - trim whitespace from bank details
    const sanitizedAccountNo = requestData.bank_account_no.trim();
    const sanitizedAccountNoConfirm = requestData.bank_account_no_confirmation.trim();
    const sanitizedIfsc = requestData.ifsc_code?.trim().replace(/[^A-Z0-9]/gi, "").toUpperCase() || "";

    // Build Nupay API payload (field mapping as per API doc - EXACT field names)
    // Nupay expects full word: "Savings", "Current", "CC", "OTHER"
    const nupayPayload: Record<string, any> = {
      loan_no: requestData.loan_no,
      seq_tp: requestData.seq_type,
      frqcy: requestData.frequency,
      category_id: requestData.category_id || 15, // Category 15 (Others) required for ADHO frequency
      colltn_amt: requestData.collection_amount,
      debit_type: requestData.debit_type || false,
      frst_colltn_dt: requestData.first_collection_date,
      colltn_until_cncl: requestData.collection_until_cancel || false,
      account_holder_name: requestData.account_holder_name.trim(),
      bank_account_no: sanitizedAccountNo,
      bank_account_no_confirmation: sanitizedAccountNoConfirm,
      bank_id: requestData.bank_id,
      account_type: requestData.account_type, // Use full word: Savings, Current, CC, OTHER
      mobile_no: requestData.mobile_no,
      tel_no: "", // Required field per API
      addnl2: "",
      addnl3: "",
      addnl4: "",
      addnl5: "",
    };

    // Optional fields - use EXACT field names per API spec
    if (requestData.final_collection_date) {
      nupayPayload.fnl_colltn_dt = requestData.final_collection_date;
    }
    if (sanitizedIfsc && sanitizedIfsc.length === 11) {
      nupayPayload.ifsc_code = sanitizedIfsc;
    }
    if (requestData.email) {
      nupayPayload.email = requestData.email;
    }
    // auth_type should be empty string if not specified per API sample
    nupayPayload.auth_type = requestData.auth_type || "";

    // Additional data fields (addnl2-5)
    if (requestData.additional_data) {
      if (requestData.additional_data.addnl2) nupayPayload.addnl2 = requestData.additional_data.addnl2;
      if (requestData.additional_data.addnl3) nupayPayload.addnl3 = requestData.additional_data.addnl3;
      if (requestData.additional_data.addnl4) nupayPayload.addnl4 = requestData.additional_data.addnl4;
      if (requestData.additional_data.addnl5) nupayPayload.addnl5 = requestData.additional_data.addnl5;
    }

    // Add redirect and webhook URLs from config
    if (config.redirect_url) {
      nupayPayload.redirect_url = config.redirect_url;
    }
    if (config.webhook_url) {
      nupayPayload.webhook_url = config.webhook_url;
    }

    // Call Nupay eMandate API
    const mandateEndpoint = `${config.api_endpoint}/api/EMandate/eManadate`;
    console.log(`[Nupay-CreateMandate] Creating mandate at ${mandateEndpoint}`);
    console.log(`[Nupay-CreateMandate] Payload:`, JSON.stringify(nupayPayload));

    // Use correct headers per API spec: "Token" header (not "Authorization: Bearer")
    const mandateResponse = await fetch(mandateEndpoint, {
      method: "POST",
      headers: {
        "api-key": config.api_key,
        "Token": token, // Correct header per API spec
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nupayPayload),
    });

    const responseText = await mandateResponse.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error("[Nupay-CreateMandate] Failed to parse response:", responseText);
      responseData = { raw_response: responseText };
    }

    console.log(`[Nupay-CreateMandate] Response:`, JSON.stringify(responseData));

    // Check for NuPay API-level errors (HTTP 200 but StatusCode != NP000)
    const statusCode = responseData.StatusCode || responseData.statusCode;
    if (statusCode && statusCode !== "NP000") {
      const statusDesc = responseData.StatusDesc || responseData.statusDesc || "Unknown NuPay error";
      console.error(`[Nupay-CreateMandate] NuPay API error: ${statusCode} - ${statusDesc}`);

      // Still save the failed attempt to DB for audit
      await supabase.from("nupay_mandates").insert({
        org_id: requestData.org_id,
        loan_application_id: requestData.loan_application_id,
        contact_id: requestData.contact_id,
        loan_no: requestData.loan_no,
        status: "failed",
        seq_type: requestData.seq_type,
        frequency: requestData.frequency,
        collection_amount: requestData.collection_amount,
        first_collection_date: requestData.first_collection_date,
        account_holder_name: requestData.account_holder_name.trim(),
        bank_account_no: sanitizedAccountNo,
        ifsc_code: sanitizedIfsc || null,
        bank_id: requestData.bank_id,
        bank_name: requestData.bank_name,
        account_type: requestData.account_type,
        auth_type: requestData.auth_type || "",
        mobile_no: requestData.mobile_no,
        email: requestData.email,
        request_payload: nupayPayload,
        response_payload: responseData,
        created_by: user.id,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: statusDesc,
          nupay_status_code: statusCode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract Nupay mandate details - API returns nested structure under data.customer and data.url
    const customerData = responseData.data?.customer;
    const nupayId = customerData?.id || responseData.id || responseData.Id;
    const nupayRefNo = customerData?.nupay_ref_no || responseData.ref_no || responseData.RefNo;
    const registrationUrl = responseData.data?.url || responseData.data?.registration_url || responseData.url || responseData.registration_url;

    console.log(`[Nupay-CreateMandate] Extracted - nupayId: ${nupayId}, refNo: ${nupayRefNo}, url: ${registrationUrl}`);

    // Store mandate in database
    const { data: mandate, error: insertError } = await supabase
      .from("nupay_mandates")
      .insert({
        org_id: requestData.org_id,
        loan_application_id: requestData.loan_application_id,
        contact_id: requestData.contact_id,
        nupay_id: nupayId,
        nupay_ref_no: nupayRefNo,
        loan_no: requestData.loan_no,
        status: mandateResponse.ok ? "submitted" : "pending",
        seq_type: requestData.seq_type,
        frequency: requestData.frequency,
        category_id: requestData.category_id || 15,
        collection_amount: requestData.collection_amount,
        debit_type: requestData.debit_type || false,
        first_collection_date: requestData.first_collection_date,
        final_collection_date: requestData.final_collection_date,
        collection_until_cancel: requestData.collection_until_cancel || false,
        account_holder_name: requestData.account_holder_name.trim(),
        bank_account_no: sanitizedAccountNo,
        ifsc_code: sanitizedIfsc || null,
        bank_id: requestData.bank_id,
        bank_name: requestData.bank_name,
        account_type: requestData.account_type,
        auth_type: requestData.auth_type || "",
        mobile_no: requestData.mobile_no,
        email: requestData.email,
        additional_data: requestData.additional_data || {},
        registration_url: registrationUrl,
        request_payload: nupayPayload,
        response_payload: responseData,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Nupay-CreateMandate] Failed to save mandate:", insertError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to save mandate record", 
          details: insertError.message,
          nupay_response: responseData 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mandateResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Nupay API error",
          mandate_id: mandate.id,
          nupay_response: responseData 
        }),
        { status: mandateResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send automated notifications if registration URL is available
    let notificationResults = null;
    if (registrationUrl) {
      try {
        console.log("[Nupay-CreateMandate] Triggering automated notifications...");
        const notifyResponse = await fetch(`${supabaseUrl}/functions/v1/send-emandate-notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            org_id: requestData.org_id,
            signer_name: requestData.account_holder_name,
            signer_email: requestData.email,
            signer_mobile: requestData.mobile_no,
            registration_url: registrationUrl,
            loan_no: requestData.loan_no,
            collection_amount: requestData.collection_amount,
            channels: ["whatsapp", "email"],
          }),
        });

        if (notifyResponse.ok) {
          notificationResults = await notifyResponse.json();
          console.log("[Nupay-CreateMandate] Notification results:", JSON.stringify(notificationResults));
        } else {
          const errorText = await notifyResponse.text();
          console.warn("[Nupay-CreateMandate] Notification request failed:", errorText);
        }
      } catch (notifyError) {
        console.warn("[Nupay-CreateMandate] Notification send failed:", notifyError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        mandate_id: mandate.id,
        nupay_id: nupayId,
        registration_url: registrationUrl,
        status: "submitted",
        notifications: notificationResults
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Nupay-CreateMandate] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
