import { getSupabaseClient } from "../_shared/supabaseClient.ts";
import { uploadToR2 } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    // Verify authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orgId = formData.get("org_id") as string | null;
    const applicationId = formData.get("application_id") as string | null;
    const folder = (formData.get("folder") as string | null) || "uploads";

    if (!file || !orgId || !applicationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: file, org_id, application_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fileExt = file.name.split(".").pop() || "bin";
    const r2Key = `loan-docs/${orgId}/${applicationId}/${folder}/${Date.now()}.${fileExt}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = await uploadToR2(r2Key, bytes, file.type || "application/octet-stream");

    return new Response(
      JSON.stringify({ success: true, url, key: r2Key }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[staff-document-upload] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Upload failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
