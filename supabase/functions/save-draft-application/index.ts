import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Received draft application data:", JSON.stringify(body, null, 2));

    const {
      formSlug,
      draftId,
      loanDetails,
      personalDetails,
      geolocation,
    } = body;

    // Validate required fields
    if (!formSlug) {
      console.error("Missing formSlug");
      return new Response(
        JSON.stringify({ error: "Form slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!personalDetails?.fullName || !personalDetails?.mobile) {
      console.error("Missing required personal details");
      return new Response(
        JSON.stringify({ error: "Name and mobile are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get form config to get org_id
    const { data: formConfig, error: formError } = await supabase
      .from("loan_application_forms")
      .select("id, org_id, product_type")
      .eq("slug", formSlug)
      .eq("is_active", true)
      .single();

    if (formError || !formConfig) {
      console.error("Form not found:", formError);
      return new Response(
        JSON.stringify({ error: "Invalid form" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Form config found:", formConfig);

    // Check if we're updating an existing draft or creating new
    if (draftId) {
      // Update existing draft application
      console.log("Updating existing draft:", draftId);
      
      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({
          requested_amount: parseFloat(loanDetails?.amount) || 0,
          tenure_months: loanDetails?.tenure || 12,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId);

      if (updateError) {
        console.error("Error updating draft:", updateError);
        throw updateError;
      }

      // Update applicant details
      const { error: applicantUpdateError } = await supabase
        .from("loan_applicants")
        .update({
          full_name: personalDetails.fullName,
          dob: personalDetails.dob || null,
          gender: personalDetails.gender || null,
          marital_status: personalDetails.maritalStatus || null,
          pan_number: personalDetails.panNumber || null,
          aadhaar_number: personalDetails.aadhaarNumber || null,
          mobile: personalDetails.mobile,
          email: personalDetails.email || null,
          father_name: personalDetails.fatherName || null,
          updated_at: new Date().toISOString(),
        })
        .eq("loan_application_id", draftId)
        .eq("is_primary", true);

      if (applicantUpdateError) {
        console.error("Error updating applicant:", applicantUpdateError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          draftId,
          message: "Draft updated successfully" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new draft application
    console.log("Creating new draft application");

    const { data: application, error: appError } = await supabase
      .from("loan_applications")
      .insert({
        org_id: formConfig.org_id,
        product_type: formConfig.product_type || loanDetails?.productType || "personal_loan",
        requested_amount: parseFloat(loanDetails?.amount) || 0,
        tenure_months: loanDetails?.tenure || 12,
        status: "draft",
        current_stage: "application",
        source: "public_form",
        form_id: formConfig.id,
        latitude: geolocation?.latitude || null,
        longitude: geolocation?.longitude || null,
        geolocation_accuracy: geolocation?.accuracy || null,
      })
      .select("id, application_number")
      .single();

    if (appError) {
      console.error("Error creating draft application:", appError);
      throw appError;
    }

    console.log("Draft application created:", application);

    // Create primary applicant record
    const { data: applicant, error: applicantError } = await supabase
      .from("loan_applicants")
      .insert({
        loan_application_id: application.id,
        applicant_type: "primary",
        is_primary: true,
        full_name: personalDetails.fullName,
        dob: personalDetails.dob || null,
        gender: personalDetails.gender || null,
        marital_status: personalDetails.maritalStatus || null,
        pan_number: personalDetails.panNumber || null,
        aadhaar_number: personalDetails.aadhaarNumber || null,
        mobile: personalDetails.mobile,
        email: personalDetails.email || null,
        father_name: personalDetails.fatherName || null,
      })
      .select("id")
      .single();

    if (applicantError) {
      console.error("Error creating applicant:", applicantError);
      // Don't throw - application was created, just log the error
    } else {
      console.log("Applicant created:", applicant);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        draftId: application.id,
        applicationNumber: application.application_number,
        message: "Draft saved successfully" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in save-draft-application:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to save draft",
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
