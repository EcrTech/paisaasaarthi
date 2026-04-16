import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToR2 } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse multipart form data
    const formData = await req.formData();
    const videoFile = formData.get("video") as File | null;
    const applicationId = formData.get("application_id") as string | null;
    const orgId = formData.get("org_id") as string | null;

    // Validate required fields
    if (!videoFile) {
      return new Response(
        JSON.stringify({ error: "Video file is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: "Application ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "Organization ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing video upload for application: ${applicationId}`);

    // Verify application exists and get applicant info
    const { data: application, error: appError } = await supabase
      .from("loan_applications")
      .select("id, loan_applicants(first_name, last_name)")
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      console.error("Application not found:", appError);
      return new Response(
        JSON.stringify({ error: "Application not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `videokyc/referral/${applicationId}/${timestamp}.webm`;

    // Read file as ArrayBuffer
    const arrayBuffer = await videoFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to R2
    let recordingUrl: string;
    try {
      recordingUrl = await uploadToR2(fileName, uint8Array, "video/webm");
    } catch (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(
        JSON.stringify({ error: "Failed to upload video", details: String(uploadErr) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Video uploaded successfully to R2:", recordingUrl);

    // Create loan_verifications record
    const { error: verificationError } = await supabase
      .from("loan_verifications")
      .insert({
        loan_application_id: applicationId,
        verification_type: "video_kyc",
        status: "success",
        response_data: {
          recording_url: recordingUrl,
          uploaded_at: new Date().toISOString(),
          source: "referral_application",
        },
        verified_at: new Date().toISOString(),
      });

    if (verificationError) {
      console.error("Verification record error:", verificationError);
      // Don't fail the request, video is already uploaded
      console.warn("Video uploaded but verification record failed to update");
    }

    // Build applicant name from linked loan_applicants
    const applicantData = (application as { loan_applicants?: { first_name?: string; last_name?: string }[] }).loan_applicants?.[0];
    const applicantName = applicantData 
      ? `${applicantData.first_name || ''} ${applicantData.last_name || ''}`.trim() 
      : 'Unknown Applicant';

    // Also create a videokyc_recordings record for tracking
    const { error: recordingError } = await supabase
      .from("videokyc_recordings")
      .insert({
        org_id: orgId,
        application_id: applicationId,
        applicant_name: applicantName,
        status: "completed",
        recording_url: recordingUrl,
        completed_at: new Date().toISOString(),
      });

    if (recordingError) {
      console.warn("VideoKYC recording record creation failed:", recordingError);
      // Don't fail - this is supplementary tracking
    }

    return new Response(
      JSON.stringify({
        success: true,
        recording_url: recordingUrl,
        message: "Video KYC uploaded successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
