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

    const { panNumber, applicationId, orgId } = await req.json();

    if (!panNumber) {
      return new Response(
        JSON.stringify({ error: "PAN number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const panUpper = panNumber.toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panUpper)) {
      return new Response(
        JSON.stringify({ error: "Invalid PAN format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[surepass-pan-verify] Verifying PAN: ${panUpper.slice(0, 5)}*****`
    );

    // Call Surepass PAN API
    const response = await callWithRetry(
      `${SUREPASS_BASE_URL}/api/v1/pan/pan`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUREPASS_TOKEN}`,
        },
        body: JSON.stringify({ id_number: panUpper }),
      }
    );

    const responseText = await response.text();
    console.log(`[surepass-pan-verify] HTTP ${response.status} | Response: ${responseText}`);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error("[surepass-pan-verify] Failed to parse response as JSON");
      return new Response(
        JSON.stringify({
          error: "Invalid response from Surepass API",
          debug: { raw_response: responseText, http_status: response.status },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      console.error(`[surepass-pan-verify] API returned HTTP ${response.status}`);
      return new Response(
        JSON.stringify({
          error: responseData.message || `Surepass API returned HTTP ${response.status}`,
          details: responseData,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract data — Surepass returns { success, status_code, message_code, message, data: { ... } }
    const panData = responseData.data || {};
    const isValid = responseData.success === true && panData.pan_number;
    const panName = panData.full_name || panData.name || "";
    const panDob = panData.dob || "";
    const panCategory = panData.category || "";

    console.log(
      `[surepass-pan-verify] Result — valid: ${isValid}, name: ${panName}`
    );

    // Save verification to database
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (applicationId) {
      const { error: insertError } = await adminClient
        .from("loan_verifications")
        .insert({
          loan_application_id: applicationId,
          verification_type: "pan",
          verification_source: "surepass",
          status: isValid ? "success" : "failed",
          request_data: { pan_number: panUpper },
          response_data: panData,
          verified_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("[surepass-pan-verify] Failed to save verification:", insertError);
      }

      // Applicant DOB enrichment is now handled by
      // DB trigger enrich_applicant_from_verification() on loan_verifications
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          pan_number: panData.pan_number || panUpper,
          name: panName,
          dob: panDob,
          category: panCategory,
          is_valid: !!isValid,
        },
        debug: {
          raw_request: {
            url: `${SUREPASS_BASE_URL}/api/v1/pan/pan`,
            body: { id_number: panUpper },
          },
          raw_response: responseData,
          http_status: response.status,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[surepass-pan-verify] Unhandled error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
