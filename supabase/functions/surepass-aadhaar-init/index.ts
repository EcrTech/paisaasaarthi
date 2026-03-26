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
    const body = await req.json();
    const { verificationId, applicationId } = body;

    if (!verificationId && !applicationId) {
      return new Response(
        JSON.stringify({ success: false, error: "verificationId or applicationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let recordId = verificationId;

    // If applicationId provided, check for existing successful Aadhaar verification (24h dedup)
    if (applicationId) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentAadhaar } = await supabase
        .from("loan_verifications")
        .select("id, response_data")
        .eq("loan_application_id", applicationId)
        .eq("verification_type", "aadhaar")
        .eq("status", "success")
        .gte("verified_at", twentyFourHoursAgo)
        .order("verified_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentAadhaar) {
        console.log(`[surepass-aadhaar-init] Aadhaar already verified for application ${applicationId} in last 24h, skipping`);
        return new Response(
          JSON.stringify({
            success: false,
            alreadyVerified: true,
            error: "Aadhaar has already been verified for this application.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If applicationId provided (referral flow), create the verification record
    if (!verificationId && applicationId) {
      const { data: newRecord, error: insertError } = await supabase
        .from("loan_verifications")
        .insert({
          loan_application_id: applicationId,
          verification_type: "aadhaar",
          verification_source: "surepass",
          status: "pending",
          request_data: { initiated_at: new Date().toISOString() },
        })
        .select("id")
        .single();

      if (insertError || !newRecord) {
        console.error("[surepass-aadhaar-init] Failed to create verification record:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create verification record" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      recordId = newRecord.id;
      console.log("[surepass-aadhaar-init] Created verification record:", recordId);
    }

    // Verify that the verification record exists and is pending/in_progress
    const { data: verification, error: fetchError } = await supabase
      .from("loan_verifications")
      .select("id, status, verification_type")
      .eq("id", recordId)
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
      .eq("id", recordId);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          client_id: responseData.data.client_id,
          token: responseData.data.token,
          verificationId: recordId,
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
