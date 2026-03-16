import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      org_id,
      environment = "uat",
      schedule_id,
      loan_application_id,
      loan_id,
      emi_number,
      amount,
      payer_name,
      payer_mobile,
      payer_email,
    } = body;

    // Validate required fields
    if (!org_id || !loan_application_id || !amount || !payer_mobile) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: org_id, loan_application_id, amount, payer_mobile" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Nupay config
    const { data: config, error: configError } = await supabase
      .from("nupay_config")
      .select("*")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: "Nupay configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.collection_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: "UPI Collection is not enabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth token
    const authResponse = await fetch(`${supabaseUrl}/functions/v1/nupay-collection-authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ org_id, environment }),
    });

    const authData = await authResponse.json();
    if (!authData.success) {
      return new Response(
        JSON.stringify({ success: false, error: authData.error || "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique client reference ID (max 20 chars as per API docs)
    const schedulePrefix = schedule_id ? schedule_id.substring(0, 8) : "UPI";
    const timestamp = Date.now().toString().slice(-10);
    const clientReferenceId = `EMI${schedulePrefix}${timestamp}`.substring(0, 20);

    // Generate customer unique ID
    const customerUniqueId = `${loan_application_id.substring(0, 8)}${Date.now().toString().slice(-6)}`;

    // Determine API endpoint
    const baseUrl = config.collection_api_endpoint || 
      (environment === "production" 
        ? "https://api.nupaybiz.com" 
        : "https://api-uat.nupaybiz.com");

    // Generate request ID
    const requestId = `COL-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Build request payload (field names per Collection 360 API v1.1 spec)
    const requestPayload = {
      client_reference_id: clientReferenceId,
      customer_unique_id: customerUniqueId,
      request_amount: amount.toString(),
      payer_name: payer_name || "Customer",
      payer_mobile_no: payer_mobile,
      payer_email: payer_email || "",
      mode: "DYNAMIC_QR", // Dynamic QR for flexibility
      expiry_minutes: 30, // 30 min expiry
      remarks: `EMI ${emi_number || ""} - Loan ${loan_id || loan_application_id.substring(0, 8)}`,
    };

    // Add provider_id if configured
    if (config.provider_id) {
      (requestPayload as any).provider_id = config.provider_id;
    }

    console.log("Creating UPI collection:", requestPayload);

    // Use env var as fallback for access key
    const accessKey = config.access_key || Deno.env.get("NUPAY_ACCESS_KEY");

    // Call Nupay API
    const collectionResponse = await fetch(`${baseUrl}/collect360/v1/initiate_transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "NP-Request-ID": requestId,
        "x-api-key": accessKey || "",
        "Authorization": `Bearer ${authData.token}`,
      },
      body: JSON.stringify(requestPayload),
    });

    const collectionData = await collectionResponse.json();
    console.log("Collection API response:", collectionData);

    // Handle duplicate request
    if (collectionData.status_code === "NP4008") {
      // Fetch existing transaction
      const { data: existingTxn } = await supabase
        .from("nupay_upi_transactions")
        .select("*")
        .eq("client_reference_id", clientReferenceId)
        .single();

      if (existingTxn) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Existing transaction found",
            transaction: existingTxn,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!collectionResponse.ok || !["NP2000", "NP2001"].includes(collectionData.status_code)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: collectionData.message || "Failed to create collection request",
          status_code: collectionData.status_code,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Store transaction
    const { data: transaction, error: insertError } = await supabase
      .from("nupay_upi_transactions")
      .insert({
        org_id,
        loan_application_id,
        schedule_id: schedule_id || null,
        client_reference_id: clientReferenceId,
        transaction_id: collectionData.data?.transaction_id,
        customer_unique_id: customerUniqueId,
        nupay_reference_id: collectionData.data?.nupay_reference_id,
        request_amount: amount,
        payment_link: collectionData.data?.payment_link,
        payee_vpa: collectionData.data?.payee_vpa,
        payer_name,
        payer_mobile,
        payer_email: payer_email || null,
        status: "pending",
        expires_at: expiresAt,
        request_payload: requestPayload,
        response_payload: collectionData,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to store transaction:", insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to store transaction record",
          details: insertError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction: {
          id: transaction.id,
          client_reference_id: clientReferenceId,
          transaction_id: collectionData.data?.transaction_id,
          payment_link: collectionData.data?.payment_link,
          payee_vpa: collectionData.data?.payee_vpa,
          amount,
          expires_at: expiresAt,
          qr_string: collectionData.data?.qr_string,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create collection error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
