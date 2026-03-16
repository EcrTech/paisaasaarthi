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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { panNumber, applicationId, orgId } = await req.json();

    if (!panNumber) {
      return new Response(JSON.stringify({ error: "PAN number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate PAN format
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panNumber.toUpperCase())) {
      return new Response(JSON.stringify({ error: "Invalid PAN format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifieduToken = Deno.env.get("VERIFIEDU_TOKEN");
    const companyId = Deno.env.get("VERIFIEDU_COMPANY_ID");
    const baseUrl = Deno.env.get("VERIFIEDU_API_BASE_URL");

    if (!verifieduToken || !companyId || !baseUrl) {
      console.log("VerifiedU credentials not configured, using mock mode");
      // Mock response for testing
      const mockResponse = {
        success: true,
        data: {
          id: `mock_${Date.now()}`,
          status: "success",
          pan_number: panNumber.toUpperCase(),
          dob: "1990-01-01",
          name: "MOCK USER NAME",
          is_valid: true,
        },
        is_mock: true,
      };

      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call VerifiedU API
    const response = await fetch(`${baseUrl}/api/verifiedu/VerifyPAN`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": verifieduToken,
        "companyid": companyId,
      },
      body: JSON.stringify({
        PanNumber: panNumber.toUpperCase(),
      }),
    });

    const responseData = await response.json();
    console.log("VerifiedU PAN response:", JSON.stringify(responseData));

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: responseData.message || "PAN verification failed",
        details: responseData 
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save verification to database if applicationId is provided
    if (applicationId && orgId) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error: insertError } = await adminClient.from("loan_verifications").insert({
        loan_application_id: applicationId,
        verification_type: "pan",
        verification_source: "verifiedu",
        status: responseData.data?.is_valid ? "success" : "failed",
        request_data: { pan_number: panNumber.toUpperCase() },
        response_data: responseData.data,
        verified_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("Failed to save PAN verification:", insertError);
      }

      // Update applicant DOB if we have a valid date from PAN verification
      if (responseData.data?.dob) {
        const { error: applicantUpdateError } = await adminClient
          .from("loan_applicants")
          .update({ dob: responseData.data.dob })
          .eq("loan_application_id", applicationId)
          .eq("applicant_type", "primary");
        
        if (applicantUpdateError) {
          console.warn("Failed to update applicant DOB from PAN:", applicantUpdateError);
        } else {
          console.log("Updated applicant DOB from PAN verification:", responseData.data.dob);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: responseData.data?.id,
        status: responseData.data?.status,
        pan_number: responseData.data?.pan_number,
        dob: responseData.data?.dob,
        name: responseData.data?.name,
        is_valid: responseData.data?.is_valid,
      },
      debug: {
        raw_request: { url: `${baseUrl}/api/verifiedu/VerifyPAN`, body: { PanNumber: panNumber.toUpperCase() } },
        raw_response: responseData,
        http_status: response.status,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in verifiedu-pan-verify:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
