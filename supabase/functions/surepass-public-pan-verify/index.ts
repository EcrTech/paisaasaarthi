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
    const { panNumber, applicationId } = await req.json();

    if (!panNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "PAN number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const panUpper = panNumber.toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panUpper)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid PAN format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[surepass-public-pan-verify] Verifying PAN: ${panUpper.slice(0, 5)}*****`);

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
    console.log(`[surepass-public-pan-verify] HTTP ${response.status} | Response: ${responseText}`);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid response from verification service" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: responseData.message || `Verification service returned HTTP ${response.status}`,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const panData = responseData.data || {};
    const isValid = responseData.success === true && panData.pan_number;
    const panName = panData.full_name || panData.name || "";
    const panDob = panData.dob || "";
    const panCategory = panData.category || "";

    console.log(`[surepass-public-pan-verify] Result — valid: ${isValid}, name: ${panName}`);

    // Save verification if applicationId provided
    if (applicationId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await supabase.from("loan_verifications").insert({
        loan_application_id: applicationId,
        verification_type: "pan",
        verification_source: "surepass",
        status: isValid ? "success" : "failed",
        request_data: { pan_number: panUpper },
        response_data: panData,
        verified_at: new Date().toISOString(),
      });

      // Update applicant DOB if valid
      if (panDob && isValid) {
        await supabase
          .from("loan_applicants")
          .update({ dob: panDob })
          .eq("loan_application_id", applicationId)
          .eq("applicant_type", "primary");
      }
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[surepass-public-pan-verify] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
