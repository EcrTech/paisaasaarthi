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

    const { applicationId, orgId, successUrl, failureUrl } = await req.json();

    if (!applicationId || !orgId) {
      return new Response(JSON.stringify({ error: "Application ID and Org ID are required" }), {
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
      const mockRequestNumber = `mock_aadhaar_${Date.now()}`;
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: `mock_${Date.now()}`,
          url: `${successUrl}?id=${mockRequestNumber}&type=aadhaar&mock=true`,
          status: "initiated",
          unique_request_number: mockRequestNumber,
        },
        is_mock: true,
        message: "Mock mode - redirect to success URL with mock data",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build callback URLs pointing to our edge function
    // VerifiedU sends POST callbacks which Azure/static hosts can't handle
    // Our edge function receives the POST and redirects to the React page via GET
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const surl = `${supabaseUrl}/functions/v1/digilocker-callback/success`;
    const furl = `${supabaseUrl}/functions/v1/digilocker-callback/failure`;

    // Call VerifiedU API
    const response = await fetch(`${baseUrl}/api/verifiedu/VerifyAadhaarViaDigilocker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": verifieduToken,
        "companyid": companyId,
      },
      body: JSON.stringify({
        surl,
        furl,
      }),
    });

    const responseData = await response.json();
    console.log("VerifiedU Aadhaar initiate response:", JSON.stringify(responseData));

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: responseData.message || "Aadhaar verification initiation failed",
        details: responseData 
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store the unique_request_number for later retrieval
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create a pending verification record
    const { error: insertError } = await adminClient.from("loan_verifications").insert({
      loan_application_id: applicationId,
      verification_type: "aadhaar",
      verification_source: "verifiedu",
      status: "in_progress",
      request_data: {
        unique_request_number: responseData.data?.unique_request_number,
        initiated_at: new Date().toISOString(),
      },
    });

    if (insertError) {
      console.error("Error inserting verification record:", insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: responseData.data?.id,
        url: responseData.data?.url,
        status: responseData.data?.status,
        unique_request_number: responseData.data?.unique_request_number,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in verifiedu-aadhaar-initiate:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
