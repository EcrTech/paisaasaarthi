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

    const { uniqueRequestNumber, applicationId, orgId } = await req.json();

    if (!uniqueRequestNumber) {
      return new Response(JSON.stringify({ error: "Unique request number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifieduToken = Deno.env.get("VERIFIEDU_TOKEN");
    const companyId = Deno.env.get("VERIFIEDU_COMPANY_ID");
    const baseUrl = Deno.env.get("VERIFIEDU_API_BASE_URL");

    // Initialize admin client for database lookups
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve applicationId and orgId from database if not provided
    // This handles the case where VerifiedU callback URL doesn't include these params
    let resolvedApplicationId = applicationId;
    let resolvedOrgId = orgId;

    if (!applicationId || !orgId) {
      console.log("Looking up application context from database for uniqueRequestNumber:", uniqueRequestNumber);
      
      // Find the pending verification record by unique_request_number in request_data
      const { data: pendingRecords, error: lookupError } = await adminClient
        .from("loan_verifications")
        .select("loan_application_id, org_id, request_data")
        .eq("status", "in_progress")
        .eq("verification_type", "aadhaar")
        .eq("verification_source", "verifiedu")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (lookupError) {
        console.error("Error looking up pending verification:", lookupError);
      } else if (pendingRecords && pendingRecords.length > 0) {
        // Find the record matching our unique_request_number
        const matchingRecord = pendingRecords.find(r => {
          const requestData = r.request_data as Record<string, unknown> | null;
          return requestData?.unique_request_number === uniqueRequestNumber;
        });
        
        if (matchingRecord) {
          resolvedApplicationId = matchingRecord.loan_application_id;
          resolvedOrgId = matchingRecord.org_id;
          console.log("Found matching verification record:", {
            applicationId: resolvedApplicationId,
            orgId: resolvedOrgId
          });
        } else {
          console.log("No matching verification record found for uniqueRequestNumber:", uniqueRequestNumber);
        }
      }
    }

    if (!verifieduToken || !companyId || !baseUrl) {
      console.log("VerifiedU credentials not configured, using mock mode");
      // Mock response for testing
      const mockResponse = {
        success: true,
        data: {
          aadhaar_uid: "XXXX-XXXX-1234",
          name: "MOCK USER NAME",
          gender: "Male",
          dob: "1990-01-01",
          addresses: [{
            combined: "123 Mock Street, Mock City, Mock State - 123456",
            house: "123",
            street: "Mock Street",
            landmark: "",
            locality: "Mock Locality",
            vtc: "Mock VTC",
            subdist: "Mock Subdist",
            dist: "Mock City",
            state: "Mock State",
            country: "India",
            pc: "123456",
          }],
          is_valid: true,
          photo: null,
        },
        is_mock: true,
        applicationId: resolvedApplicationId,
        orgId: resolvedOrgId,
      };

      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call VerifiedU API
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
    console.log("VerifiedU Aadhaar details response:", JSON.stringify(responseData));

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: responseData.message || "Failed to fetch Aadhaar details",
        details: responseData 
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update verification record in database if we have applicationId (original or resolved)
    if (resolvedApplicationId && resolvedOrgId) {
      // Find and update the existing verification record
      const { data: existingVerification } = await adminClient
        .from("loan_verifications")
        .select("id")
        .eq("loan_application_id", resolvedApplicationId)
        .eq("verification_type", "aadhaar")
        .eq("verification_source", "verifiedu")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const verificationData = {
        status: responseData.is_valid ? "success" : "failed",
        response_data: {
          aadhaar_uid: responseData.aadhaar_uid,
          name: responseData.name,
          gender: responseData.gender,
          dob: responseData.dob,
          addresses: responseData.addresses,
          is_valid: responseData.is_valid,
          verified_address: responseData.addresses?.[0]?.combined || "",
        },
        verified_at: new Date().toISOString(),
      };

      if (existingVerification) {
        await adminClient
          .from("loan_verifications")
          .update(verificationData)
          .eq("id", existingVerification.id);
      } else {
        await adminClient.from("loan_verifications").insert({
          loan_application_id: resolvedApplicationId,
          verification_type: "aadhaar",
          verification_source: "verifiedu",
          request_data: { unique_request_number: uniqueRequestNumber },
          ...verificationData,
        });
      }

      // Update applicant record with verified DOB, gender, and ADDRESS from Aadhaar
      if (responseData.dob || responseData.gender || responseData.addresses?.length) {
        const updateData: Record<string, unknown> = {};
        
        if (responseData.dob) {
          updateData.dob = responseData.dob;
        }
        if (responseData.gender) {
          updateData.gender = responseData.gender;
        }
        
        // Sync verified address to current_address JSONB field
        if (responseData.addresses?.length > 0) {
          const addr = responseData.addresses[0];
          
          // Build line1: house + street + landmark
          const line1Parts = [addr.house, addr.street, addr.landmark].filter(Boolean);
          const line1 = line1Parts.join(', ') || '';
          
          // Build line2: locality + vtc + subdist
          const line2Parts = [addr.locality, addr.vtc, addr.subdist].filter(Boolean);
          const line2 = line2Parts.join(', ') || '';
          
          // Extract city (dist), state, and pincode (pc) - MANDATORY fields
          const city = addr.dist || '';
          const state = addr.state || '';          // MANDATORY
          const pincode = addr.pc || '';           // MANDATORY
          
          updateData.current_address = {
            line1: line1,
            line2: line2,
            city: city,
            state: state,
            pincode: pincode
          };
          
          console.log("Extracted address from Aadhaar:", {
            line1, line2, city, state, pincode
          });
        }
        
        const { error: applicantUpdateError } = await adminClient
          .from("loan_applicants")
          .update(updateData)
          .eq("loan_application_id", resolvedApplicationId)
          .eq("applicant_type", "primary");
        
        if (applicantUpdateError) {
          console.warn("Failed to update applicant from Aadhaar:", applicantUpdateError);
        } else {
          console.log("Updated applicant from Aadhaar verification:", updateData);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        aadhaar_uid: responseData.aadhaar_uid,
        name: responseData.name,
        gender: responseData.gender,
        dob: responseData.dob,
        addresses: responseData.addresses,
        is_valid: responseData.is_valid,
      },
      applicationId: resolvedApplicationId,
      orgId: resolvedOrgId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in verifiedu-aadhaar-details:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
