import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUREPASS_BASE_URL =
  Deno.env.get("SUREPASS_BASE_URL") || "https://sandbox.surepass.app";
const SUREPASS_TOKEN = Deno.env.get("SUREPASS_TOKEN") || "";

async function callWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  for (let i = 0; i <= maxRetries; i++) {
    const response = await fetch(url, options);
    if (response.ok || response.status < 500) return response;
    if (i < maxRetries) {
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  return fetch(url, options);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // TEMPORARILY DISABLED — remove this block to re-enable
  return new Response(
    JSON.stringify({ success: false }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { accountNumber, ifscCode, applicationId, orgId } = await req.json();

    if (!accountNumber || !ifscCode) {
      return new Response(
        JSON.stringify({ error: "Account number and IFSC code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize IFSC code: 5th character must always be digit '0', not letter 'O'
    let sanitizedIfsc = ifscCode.toUpperCase().trim();
    if (sanitizedIfsc.length === 11 && sanitizedIfsc[4] === 'O') {
      sanitizedIfsc = sanitizedIfsc.substring(0, 4) + '0' + sanitizedIfsc.substring(5);
      console.log(`[surepass-bank-verify] IFSC sanitized: ${ifscCode} -> ${sanitizedIfsc}`);
    }

    console.log(`[surepass-bank-verify] Verifying account: ****${accountNumber.slice(-4)}, IFSC: ${sanitizedIfsc}`);

    const response = await callWithRetry(
      `${SUREPASS_BASE_URL}/api/v1/bank-verification/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUREPASS_TOKEN}`,
        },
        body: JSON.stringify({
          id_number: accountNumber,
          ifsc: sanitizedIfsc,
        }),
      }
    );

    const responseText = await response.text();
    console.log(`[surepass-bank-verify] HTTP ${response.status} | Response: ${responseText}`);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error("[surepass-bank-verify] Failed to parse response as JSON");
      return new Response(
        JSON.stringify({
          error: "Invalid response from Surepass API",
          debug: { raw_response: responseText, http_status: response.status },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      console.error(`[surepass-bank-verify] API returned HTTP ${response.status}`);
      return new Response(
        JSON.stringify({
          error: responseData.message || `Surepass API returned HTTP ${response.status}`,
          details: responseData,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bankData = responseData.data || {};
    const isValid = responseData.success === true && bankData.full_name;
    const accountHolderName = bankData.full_name || "";

    console.log(`[surepass-bank-verify] Result — valid: ${isValid}, name: ${accountHolderName}`);

    // Save verification to database
    if (applicationId) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error: insertError } = await adminClient
        .from("loan_verifications")
        .insert({
          loan_application_id: applicationId,
          verification_type: "bank_account",
          verification_source: "surepass",
          status: isValid ? "success" : "failed",
          request_data: {
            account_number: accountNumber,
            ifsc_code: sanitizedIfsc,
          },
          response_data: {
            account_holder_name: accountHolderName,
            bank_name: bankData.bank_name || "",
            branch_name: bankData.branch || "",
            is_valid: !!isValid,
          },
          verified_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("[surepass-bank-verify] Failed to save verification:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          account_number: accountNumber,
          ifsc_code: sanitizedIfsc,
          account_holder_name: accountHolderName,
          is_valid: !!isValid,
        },
        verification_status: isValid ? "success" : "failed",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[surepass-bank-verify] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
