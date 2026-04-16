/**
 * Migrates existing videokyc-recordings from Supabase Storage to Cloudflare R2.
 * For each file:
 *   1. Download from Supabase
 *   2. Upload to R2
 *   3. Update URLs in videokyc_recordings and loan_verifications tables
 *   4. Delete from Supabase storage
 *
 * Run: node scripts/migrate-videokyc-to-r2.mjs
 * Safe to re-run — skips files already pointing to R2.
 */

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';

// Supabase
const SUPABASE_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';
const SUPABASE_STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/videokyc-recordings/`;

// R2
const R2_ACCOUNT_ID = 'd58b54ae5a23bd00df9ff399e1e34c0e';
const R2_ACCESS_KEY_ID = '895145c9b16c145e9bab27589e5bd9ec';
const R2_SECRET_ACCESS_KEY = 'b7673c0ed50c019642f758fc0d34a01d65c1ec55ab19dd7cc87aa92b4b0be117';
const R2_BUCKET = 'paisaasaarthi';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_BASE = 'https://pub-45f68799e99e40dba88b93e0f65da4bc.r2.dev';

const BATCH_SIZE = 5; // concurrent uploads

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: 's3',
});

async function uploadToR2(key, body, contentType) {
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
  const res = await r2.fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(body.byteLength),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed [${res.status}]: ${text}`);
  }
  return `${R2_PUBLIC_BASE}/${key}`;
}

function extractStoragePath(url) {
  if (url.startsWith(SUPABASE_STORAGE_PREFIX)) {
    return url.slice(SUPABASE_STORAGE_PREFIX.length);
  }
  const match = url.match(/\/videokyc-recordings\/(.+)/);
  return match ? match[1] : null;
}

// Fetch all videokyc recordings still pointing to Supabase
console.log('Fetching recordings still on Supabase...');
const { data: recordings, error } = await supabase
  .from('videokyc_recordings')
  .select('id, application_id, recording_url')
  .not('recording_url', 'is', null)
  .not('recording_url', 'like', `${R2_PUBLIC_BASE}%`);

if (error) { console.error(error); process.exit(1); }
console.log(`Found ${recordings.length} recordings to migrate\n`);

let migrated = 0, failed = 0;

for (let i = 0; i < recordings.length; i += BATCH_SIZE) {
  const batch = recordings.slice(i, i + BATCH_SIZE);

  await Promise.all(batch.map(async (rec) => {
    const storagePath = extractStoragePath(rec.recording_url);
    if (!storagePath) {
      console.warn(`  [SKIP] Unknown URL format: ${rec.recording_url}`);
      return;
    }

    try {
      // 1. Download from Supabase
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('videokyc-recordings')
        .download(storagePath);
      if (dlErr) throw new Error(`Download failed: ${dlErr.message}`);

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 2. Upload to R2 (preserve path under videokyc/ prefix)
      const r2Key = `videokyc/${storagePath}`;
      const newUrl = await uploadToR2(r2Key, uint8Array, 'video/webm');

      // 3. Update videokyc_recordings
      await supabase
        .from('videokyc_recordings')
        .update({ recording_url: newUrl })
        .eq('id', rec.id);

      // 4. Update loan_verifications (JSONB field)
      await supabase.rpc('update_videokyc_recording_url', {
        p_application_id: rec.application_id,
        p_old_url: rec.recording_url,
        p_new_url: newUrl,
      });

      // 5. Delete from Supabase storage
      await supabase.storage.from('videokyc-recordings').remove([storagePath]);

      console.log(`  [OK] ${storagePath} → ${newUrl}`);
      migrated++;
    } catch (err) {
      console.error(`  [FAIL] ${storagePath}: ${err.message}`);
      failed++;
    }
  }));

  console.log(`Progress: ${Math.min(i + BATCH_SIZE, recordings.length)}/${recordings.length}`);
}

console.log(`\nDone. Migrated: ${migrated}, Failed: ${failed}`);
