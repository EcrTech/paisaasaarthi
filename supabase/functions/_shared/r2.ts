import { AwsClient } from "npm:aws4fetch@1.0.11";

const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")!;
const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const bucket = Deno.env.get("R2_BUCKET")!;

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
export const R2_PUBLIC_BASE = Deno.env.get("R2_PUBLIC_URL")!;

const client = new AwsClient({
  accessKeyId,
  secretAccessKey,
  service: "s3",
});

/**
 * Upload a file to Cloudflare R2 and return its public URL.
 */
export async function uploadToR2(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<string> {
  const url = `${endpoint}/${bucket}/${key}`;

  const response = await client.fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 upload failed [${response.status}]: ${text}`);
  }

  return `${R2_PUBLIC_BASE}/${key}`;
}
