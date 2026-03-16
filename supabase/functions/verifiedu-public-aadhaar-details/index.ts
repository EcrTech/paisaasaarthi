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
    const { uniqueRequestNumber } = await req.json();

    if (!uniqueRequestNumber) {
      return new Response(JSON.stringify({ error: "Unique request number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifieduToken = Deno.env.get("VERIFIEDU_TOKEN");
    const companyId = Deno.env.get("VERIFIEDU_COMPANY_ID");
    const baseUrl = Deno.env.get("VERIFIEDU_API_BASE_URL");

    if (!verifieduToken || !companyId || !baseUrl) {
      console.log("[verifiedu-public-aadhaar-details] VerifiedU credentials not configured, using mock mode");
      // Mock response for testing
      const mockResponse = {
        success: true,
        data: {
          aadhaar_uid: "XXXX-XXXX-1234",
          name: "MOCK USER NAME",
          gender: "Male",
          dob: "1990-01-15",
          addresses: [{
            combined: "123 Mock Street, Mock Locality, Mock City, Mock State - 123456",
            house: "123",
            street: "Mock Street",
            landmark: "Near Mock Landmark",
            locality: "Mock Locality",
            vtc: "Mock VTC",
            subdist: "Mock Subdist",
            dist: "Mock City",
            state: "Mock State",
            country: "India",
            pc: "123456",
          }],
          is_valid: true,
        },
        is_mock: true,
      };

      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call VerifiedU API to get Aadhaar details
    console.log("[verifiedu-public-aadhaar-details] Fetching Aadhaar details for:", uniqueRequestNumber);
    
    const response = await fetch(`${baseUrl}/api/verifiedu/GetAadhaarDetailsById`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": verifieduToken,
        "companyid": companyId,
      },
      body: JSON.stringify({
        unique_request_number: uniqueRequestNumber,
      }),
    });

    const responseData = await response.json();
    console.log("[verifiedu-public-aadhaar-details] VerifiedU response received:", JSON.stringify(responseData));

    if (!response.ok) {
      console.error("[verifiedu-public-aadhaar-details] API error:", responseData);
      return new Response(JSON.stringify({
        success: false,
        error: responseData.message || "Failed to fetch Aadhaar details",
        details: responseData
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // VerifiedU wraps aadhaar response in aadhaar_Data (note capital D)
    const details = responseData.aadhaar_Data || responseData.data || responseData;

    // SAFEGUARD: Verify returned request number matches what we requested
    const returnedRequestNumber = details.unique_request_number;
    if (returnedRequestNumber && returnedRequestNumber !== uniqueRequestNumber) {
      console.error("[verifiedu-public-aadhaar-details] CRITICAL: Request number mismatch!", {
        requested: uniqueRequestNumber,
        returned: returnedRequestNumber,
      });
      return new Response(JSON.stringify({
        success: false,
        error: "Data mismatch detected",
        message: "The verification service returned data for a different request. Please try again.",
        mismatch: true,
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isStillProcessing = details.status === "in_process" || details.status === "initiated";

    // Return structured Aadhaar data
    return new Response(JSON.stringify({
      success: true,
      data: {
        aadhaar_uid: details.aadhaar_uid,
        name: details.name,
        gender: details.gender,
        dob: details.dob || details.date_of_birth_masked,
        addresses: details.addresses,
        is_valid: details.is_valid,
        status: details.status,
      },
      still_processing: isStillProcessing,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[verifiedu-public-aadhaar-details] Error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
