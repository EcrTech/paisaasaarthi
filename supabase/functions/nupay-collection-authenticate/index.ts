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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { org_id, environment } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for cached valid token (with 5 min buffer)
    const bufferTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data: cachedToken } = await supabase
      .from("nupay_upi_auth_tokens")
      .select("*")
      .eq("org_id", org_id)
      .eq("environment", environment || "uat")
      .gt("expires_at", bufferTime)
      .single();

    if (cachedToken) {
      console.log("Using cached token for org:", org_id);
      return new Response(
        JSON.stringify({
          success: true,
          token: cachedToken.token,
          expires_at: cachedToken.expires_at,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Nupay config
    const { data: config, error: configError } = await supabase
      .from("nupay_config")
      .select("*")
      .eq("org_id", org_id)
      .eq("environment", environment || "uat")
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Nupay configuration not found for this environment" 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use env vars as fallback if DB config doesn't have the keys
    const accessKey = config.access_key || Deno.env.get("NUPAY_ACCESS_KEY");
    const accessSecret = config.access_secret || Deno.env.get("NUPAY_ACCESS_SECRET");

    if (!accessKey || !accessSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Collection 360 credentials not configured (set in nupay_config or NUPAY_ACCESS_KEY/NUPAY_ACCESS_SECRET secrets)"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine API endpoint
    const baseUrl = config.collection_api_endpoint || 
      (environment === "production" 
        ? "https://api.nupaybiz.com" 
        : "https://api-uat.nupaybiz.com");

    // Generate request ID
    const requestId = `AUTH-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Request new token from Nupay
    console.log("Requesting new token from Nupay...");
    const tokenResponse = await fetch(`${baseUrl}/onboarding/v1/users/accesstoken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "NP-Request-ID": requestId,
      },
      body: JSON.stringify({
        access_key: accessKey,
        access_secret: accessSecret,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log("Token response:", tokenData);

    if (!tokenResponse.ok || tokenData.status_code !== "NP2000") {
      return new Response(
        JSON.stringify({
          success: false,
          error: tokenData.message || "Failed to obtain access token",
          status_code: tokenData.status_code,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate expiry (25 min from now for safety)
    const expiresAt = new Date(Date.now() + 25 * 60 * 1000).toISOString();

    // Cache the new token (upsert)
    const { error: upsertError } = await supabase
      .from("nupay_upi_auth_tokens")
      .upsert({
        org_id,
        environment: environment || "uat",
        token: tokenData.data.access_token,
        expires_at: expiresAt,
      }, {
        onConflict: "org_id,environment",
      });

    if (upsertError) {
      console.error("Failed to cache token:", upsertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: tokenData.data.access_token,
        expires_at: expiresAt,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Authentication error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
