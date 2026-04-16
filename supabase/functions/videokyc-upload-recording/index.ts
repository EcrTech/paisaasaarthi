import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToR2 } from "../_shared/r2.ts";

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const token = formData.get("token") as string;
    const videoFile = formData.get("video") as File;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!videoFile) {
      return new Response(
        JSON.stringify({ error: "Video file is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing VideoKYC upload for token: ${token.substring(0, 8)}...`);

    // Verify the token first
    const { data: recording, error: findError } = await supabase
      .from("videokyc_recordings")
      .select("*")
      .eq("access_token", token)
      .single();

    if (findError || !recording) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    const now = new Date();
    const expiresAt = new Date(recording.token_expires_at);
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already completed
    if (recording.status === "completed") {
      return new Response(
        JSON.stringify({ error: "Video KYC has already been completed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to recording
    await supabase
      .from("videokyc_recordings")
      .update({ status: "recording" })
      .eq("id", recording.id);

    // Upload to R2
    const fileName = `videokyc/${recording.application_id}/${recording.id}_${Date.now()}.webm`;
    const arrayBuffer = await videoFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let recordingUrl: string;
    try {
      recordingUrl = await uploadToR2(fileName, uint8Array, "video/webm");
    } catch (uploadErr) {
      console.error("Error uploading video to R2:", uploadErr);

      await supabase
        .from("videokyc_recordings")
        .update({ status: "failed" })
        .eq("id", recording.id);

      return new Response(
        JSON.stringify({ error: "Failed to upload video", details: String(uploadErr) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the recording record
    const { error: updateError } = await supabase
      .from("videokyc_recordings")
      .update({
        status: "completed",
        recording_url: recordingUrl,
        completed_at: new Date().toISOString(),
      })
      .eq("id", recording.id);

    if (updateError) {
      console.error("Error updating recording:", updateError);
    }

    // Also update/create the loan_verifications record
    const { data: existingVerification } = await supabase
      .from("loan_verifications")
      .select("id")
      .eq("loan_application_id", recording.application_id)
      .eq("verification_type", "video_kyc")
      .single();

    if (existingVerification) {
      const { error: updateVerificationError } = await supabase
        .from("loan_verifications")
        .update({
          status: "success",
          response_data: { recording_url: recordingUrl },
          verified_at: new Date().toISOString(),
          remarks: "Video KYC completed successfully via retry link",
        })
        .eq("id", existingVerification.id);
      
      if (updateVerificationError) {
        console.error("Error updating loan_verifications:", updateVerificationError);
      }
    } else {
      const { error: insertVerificationError } = await supabase
        .from("loan_verifications")
        .insert({
          loan_application_id: recording.application_id,
          verification_type: "video_kyc",
          status: "success",
          response_data: { recording_url: recordingUrl },
          verified_at: new Date().toISOString(),
          remarks: "Video KYC completed successfully via retry link",
        });
      
      if (insertVerificationError) {
        console.error("Error inserting loan_verifications:", insertVerificationError);
      }
    }

    console.log(`VideoKYC upload completed successfully: ${recording.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        recording_url: recordingUrl,
        message: "Video KYC completed successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in videokyc-upload-recording:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
