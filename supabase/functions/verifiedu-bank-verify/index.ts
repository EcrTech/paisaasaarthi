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

    const { accountNumber, ifscCode, applicationId, orgId } = await req.json();

    if (!accountNumber || !ifscCode) {
      return new Response(JSON.stringify({ error: "Account number and IFSC code are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize IFSC code: 5th character must always be digit '0', not letter 'O'
    let sanitizedIfsc = ifscCode.toUpperCase().trim();
    if (sanitizedIfsc.length === 11) {
      // Replace letter 'O' with digit '0' at position 4 (5th char, 0-indexed)
      if (sanitizedIfsc[4] === 'O') {
        sanitizedIfsc = sanitizedIfsc.substring(0, 4) + '0' + sanitizedIfsc.substring(5);
        console.log(`[BankVerify] IFSC sanitized: ${ifscCode} -> ${sanitizedIfsc}`);
      }
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
          account_number: accountNumber,
          ifsc_code: ifscCode,
          account_holder_name: "MOCK ACCOUNT HOLDER",
          bank_name: "Mock Bank",
          branch_name: "Mock Branch",
          is_valid: true,
        },
        is_mock: true,
      };

      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call VerifiedU API
    const response = await fetch(`${baseUrl}/api/verifiedu/VerifyBankAccountNumber`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": verifieduToken,
        "companyid": companyId,
      },
      body: JSON.stringify({
        verification_type: "pennyless",
        account_number: accountNumber,
        account_ifsc: sanitizedIfsc,
      }),
    });

    const responseData = await response.json();
    console.log("VerifiedU Bank verify response:", JSON.stringify(responseData));

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: responseData.message || "Bank verification failed",
        details: responseData 
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if the API itself reported an error (HTTP 200 but success: false)
    if (!responseData.success || responseData.data === null) {
      console.error("VerifiedU API-level error:", responseData.message);
      return new Response(JSON.stringify({
        success: false,
        error: responseData.message || "Verification service error",
        verification_status: "error",
      }), {
        status: 200,
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
        verification_type: "bank_account",
        verification_source: "verifiedu",
        status: responseData.data?.is_valid ? "success" : "failed",
        request_data: { 
          account_number: accountNumber,
          ifsc_code: ifscCode,
        },
        response_data: {
          account_holder_name: responseData.data?.account_holder_name,
          bank_name: responseData.data?.bank_name || "",
          branch_name: responseData.data?.branch_name || "",
          is_valid: responseData.data?.is_valid,
        },
        verified_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("Failed to save bank verification:", insertError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: responseData.data?.id,
        status: responseData.data?.status,
        account_number: responseData.data?.account_number || accountNumber,
        ifsc_code: responseData.data?.ifsc_code || ifscCode,
        account_holder_name: responseData.data?.account_holder_name,
        is_valid: responseData.data?.is_valid,
      },
      verification_status: responseData.data?.is_valid ? "success" : "failed",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in verifiedu-bank-verify:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
