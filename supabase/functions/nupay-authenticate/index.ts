import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AuthRequest {
  org_id: string;
  environment: "uat" | "production";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { org_id, environment }: AuthRequest = await req.json();

    if (!org_id || !environment) {
      return new Response(
        JSON.stringify({ error: "org_id and environment are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for cached valid token
    const { data: cachedToken } = await supabase
      .from("nupay_auth_tokens")
      .select("*")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cachedToken) {
      console.log("[Nupay-Auth] Using cached token");
      return new Response(
        JSON.stringify({ 
          success: true, 
          token: cachedToken.token,
          expires_at: cachedToken.expires_at 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Nupay config
    const { data: config, error: configError } = await supabase
      .from("nupay_config")
      .select("*")
      .eq("org_id", org_id)
      .eq("environment", environment)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Nupay configuration not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use env var as fallback if DB config doesn't have the key
    const apiKey = config.api_key || Deno.env.get("NUPAY_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Nupay API key not configured (set in nupay_config or NUPAY_API_KEY secret)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Nupay Auth endpoint - only api-key header needed
    const authEndpoint = `${config.api_endpoint}/Auth/token`;
    console.log(`[Nupay-Auth] Requesting token from ${authEndpoint} with api-key: ${apiKey.substring(0, 8)}...`);

    const authResponse = await fetch(authEndpoint, {
      method: "GET",
      headers: {
        "api-key": apiKey,
      },
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error(`[Nupay-Auth] Authentication failed: ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Nupay", details: errorText }),
        { status: authResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authData = await authResponse.json();
    const token = authData.token || authData.Token;

    if (!token) {
      console.error("[Nupay-Auth] No token in response:", authData);
      return new Response(
        JSON.stringify({ error: "No token received from Nupay" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Token typically valid for 30 days, set expiry to 29 days to be safe
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 29);

    // Cache the token (upsert)
    const { error: cacheError } = await supabase
      .from("nupay_auth_tokens")
      .upsert({
        org_id,
        environment,
        token,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: "org_id,environment"
      });

    if (cacheError) {
      console.error("[Nupay-Auth] Failed to cache token:", cacheError);
      // Continue anyway, token is still valid
    }

    console.log("[Nupay-Auth] Token obtained and cached successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        token,
        expires_at: expiresAt.toISOString() 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Nupay-Auth] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
