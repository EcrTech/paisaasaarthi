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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { verificationId } = await req.json();

    if (!verificationId) {
      return new Response(
        JSON.stringify({ success: false, error: "verificationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify that the verification record exists and is pending/in_progress
    const { data: verification, error: fetchError } = await supabase
      .from("loan_verifications")
      .select("id, status, verification_type")
      .eq("id", verificationId)
      .single();

    if (fetchError || !verification) {
      return new Response(
        JSON.stringify({ success: false, error: "Verification record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (verification.status === "success") {
      return new Response(
        JSON.stringify({ success: false, error: "Verification already completed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Surepass DigiLocker initialize
    const response = await fetch(
      `${SUREPASS_BASE_URL}/api/v1/digilocker/initialize`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUREPASS_TOKEN}`,
        },
        body: JSON.stringify({
          data: { signup_flow: true },
        }),
      }
    );

    const responseData = await response.json();
    console.log("[surepass-aadhaar-init] Surepass response:", JSON.stringify(responseData));

    if (!responseData.success || !responseData.data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: responseData.message || "Verification service unavailable",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update verification record with client_id
    await supabase
      .from("loan_verifications")
      .update({
        status: "in_progress",
        request_data: {
          client_id: responseData.data.client_id,
          surepass_initialized_at: new Date().toISOString(),
        },
      })
      .eq("id", verificationId);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          client_id: responseData.data.client_id,
          token: responseData.data.token,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[surepass-aadhaar-init] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
