import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AwsClient } from "npm:aws4fetch@1.0.11";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")!;
const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const bucket = Deno.env.get("R2_BUCKET")!;
const R2_PUBLIC_BASE = Deno.env.get("R2_PUBLIC_URL")!;
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3" });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { key, contentType } = await req.json();
    if (!key || !contentType) {
      return new Response(JSON.stringify({ error: 'Missing key or contentType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const objectUrl = `${endpoint}/${bucket}/${key}`;
    const signed = await client.sign(
      new Request(objectUrl, { method: 'PUT', headers: { 'Content-Type': contentType } }),
      { aws: { signQuery: true, expiresIn: 900 } },
    );

    return new Response(JSON.stringify({
      uploadUrl: signed.url,
      publicUrl: `${R2_PUBLIC_BASE}/${key}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
