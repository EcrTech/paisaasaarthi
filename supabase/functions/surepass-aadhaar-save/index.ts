import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { verificationId, aadhaarData } = await req.json();

    if (!verificationId || !aadhaarData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "verificationId and aadhaarData are required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the record exists and is not already completed
    const { data: verification, error: fetchError } = await supabase
      .from("loan_verifications")
      .select("id, status, loan_application_id")
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

    // Extract key fields from Aadhaar data
    const name = aadhaarData.name || aadhaarData.full_name || "";
    const dob = aadhaarData.dob || aadhaarData.date_of_birth || "";
    const gender = aadhaarData.gender || "";
    const address =
      aadhaarData.address ||
      aadhaarData.combined_address ||
      (aadhaarData.addresses?.[0]?.combined) ||
      "";
    const aadhaarUid = aadhaarData.aadhaar_uid || aadhaarData.aadhaar_number || "";
    const last4 = aadhaarUid ? aadhaarUid.slice(-4) : "";

    // Update verification record
    const { error: updateError } = await supabase
      .from("loan_verifications")
      .update({
        status: "success",
        response_data: {
          ...aadhaarData,
          name,
          dob,
          gender,
          verified_address: address,
          aadhaar_last4: last4,
          aadhaar_status: "valid",
          is_valid: true,
        },
        verified_at: new Date().toISOString(),
      })
      .eq("id", verificationId);

    if (updateError) {
      console.error("[surepass-aadhaar-save] Update error:", updateError);
      throw updateError;
    }

    // Update applicant DOB if available
    if (dob && verification.loan_application_id) {
      const { error: applicantUpdateError } = await supabase
        .from("loan_applicants")
        .update({ dob })
        .eq("loan_application_id", verification.loan_application_id)
        .eq("applicant_type", "primary");

      if (applicantUpdateError) {
        console.warn("[surepass-aadhaar-save] Failed to update applicant DOB:", applicantUpdateError);
      }
    }

    console.log(`[surepass-aadhaar-save] Verification ${verificationId} saved successfully. Name: ${name}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[surepass-aadhaar-save] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to save details",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
