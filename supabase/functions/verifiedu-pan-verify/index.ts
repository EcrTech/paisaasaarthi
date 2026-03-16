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

    console.log(`[PAN Verify] Calling VerifiedU API at ${baseUrl}/api/verifiedu/VerifyPAN for PAN: ${panNumber.toUpperCase().slice(0, 5)}*****`);

    // Call VerifiedU API
    // Documented format: { "PanNumber": "PJUPS4536C" }
    // Expected response: { "success": true, "data": { "id", "status", "pan_number", "dob", "name", "is_valid", ... } }
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

    const responseText = await response.text();
    console.log(`[PAN Verify] HTTP ${response.status} | Response: ${responseText}`);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error("[PAN Verify] Failed to parse response as JSON");
      return new Response(JSON.stringify({
        error: "Invalid response from VerifiedU API",
        debug: { raw_response: responseText, http_status: response.status },
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for HTTP-level errors
    if (!response.ok) {
      console.error(`[PAN Verify] API returned HTTP ${response.status}:`, JSON.stringify(responseData));
      return new Response(JSON.stringify({
        error: responseData.message || responseData.Message || `VerifiedU API returned HTTP ${response.status}`,
        details: responseData,
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for API-level errors (HTTP 200 but success: false)
    if (responseData.success === false) {
      console.error("[PAN Verify] API returned success: false:", JSON.stringify(responseData));

      // Still save to DB as failed
      if (applicationId && orgId) {
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await adminClient.from("loan_verifications").insert({
          loan_application_id: applicationId,
          verification_type: "pan",
          verification_source: "verifiedu",
          status: "failed",
          request_data: { pan_number: panNumber.toUpperCase() },
          response_data: responseData,
          verified_at: new Date().toISOString(),
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: responseData.message || responseData.Message || "PAN verification failed at VerifiedU",
        debug: { raw_response: responseData },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success path — extract data from documented structure
    const panData = responseData.data || {};
    const isValid = panData.is_valid === true;
    const panName = panData.name || "";
    const panDob = panData.dob || "";

    console.log(`[PAN Verify] Result — is_valid: ${isValid}, name: ${panName}, status: ${panData.status}`);

    // Save verification to database
    if (applicationId && orgId) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error: insertError } = await adminClient.from("loan_verifications").insert({
        loan_application_id: applicationId,
        verification_type: "pan",
        verification_source: "verifiedu",
        status: isValid ? "success" : "failed",
        request_data: { pan_number: panNumber.toUpperCase() },
        response_data: panData,
        verified_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("[PAN Verify] Failed to save verification:", insertError);
      }

      // Update applicant DOB if we have a valid date from PAN verification
      if (panDob && isValid) {
        const { error: applicantUpdateError } = await adminClient
          .from("loan_applicants")
          .update({ dob: panDob })
          .eq("loan_application_id", applicationId)
          .eq("applicant_type", "primary");

        if (applicantUpdateError) {
          console.warn("[PAN Verify] Failed to update applicant DOB:", applicantUpdateError);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: panData.id,
        status: panData.status,
        pan_number: panData.pan_number || panNumber.toUpperCase(),
        dob: panDob,
        name: panName,
        is_valid: isValid,
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
    console.error("[PAN Verify] Unhandled error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
