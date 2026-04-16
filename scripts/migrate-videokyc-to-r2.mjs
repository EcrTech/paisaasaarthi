/**
 * Migrates existing videokyc-recordings from Supabase Storage to Cloudflare R2.
 *
 * Smart retry logic:
 *   - If file already exists in R2 → just update the DB URL (no re-download)
 *   - If file not in R2 → full download from Supabase + upload to R2
 *
 * Safe to re-run — skips recordings already pointing to R2 in DB.
 * Run: node scripts/migrate-videokyc-to-r2.mjs
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

const BATCH_SIZE = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: 's3',
});

function extractStoragePath(url) {
  if (url.startsWith(SUPABASE_STORAGE_PREFIX)) return url.slice(SUPABASE_STORAGE_PREFIX.length);
  const match = url.match(/\/videokyc-recordings\/(.+)/);
  return match ? match[1] : null;
}

async function existsInR2(r2Key) {
  const res = await fetch(`${R2_PUBLIC_BASE}/${r2Key}`, { method: 'HEAD' });
  return res.ok;
}

async function uploadToR2(key, body, contentType) {
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
  const res = await r2.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(body.byteLength) },
    body,
  });
  if (!res.ok) throw new Error(`R2 upload failed [${res.status}]: ${await res.text()}`);
  return `${R2_PUBLIC_BASE}/${key}`;
}

async function updateDB(rec, newUrl) {
  const { error } = await supabase
    .from('videokyc_recordings')
    .update({ recording_url: newUrl })
    .eq('id', rec.id);
  if (error) throw new Error(`DB update failed: ${error.message}`);

  await supabase.rpc('update_videokyc_recording_url', {
    p_application_id: rec.application_id,
    p_old_url: rec.recording_url,
    p_new_url: newUrl,
  });
}

// Fetch all recordings still pointing to Supabase
console.log('Fetching recordings still on Supabase...');
const { data: recordings, error } = await supabase
  .from('videokyc_recordings')
  .select('id, application_id, recording_url')
  .not('recording_url', 'is', null)
  .not('recording_url', 'like', `${R2_PUBLIC_BASE}%`);

if (error) { console.error(error); process.exit(1); }
console.log(`Found ${recordings.length} recordings to process\n`);

let dbOnly = 0, fullMigrate = 0, failed = 0;

for (let i = 0; i < recordings.length; i += BATCH_SIZE) {
  const batch = recordings.slice(i, i + BATCH_SIZE);

  await Promise.all(batch.map(async (rec) => {
    const storagePath = extractStoragePath(rec.recording_url);
    if (!storagePath) {
      console.warn(`  [SKIP] Unknown URL format: ${rec.recording_url}`);
      return;
    }

    const r2Key = `videokyc/${storagePath}`;
    const newUrl = `${R2_PUBLIC_BASE}/${r2Key}`;

    try {
      // Check if already in R2
      if (await existsInR2(r2Key)) {
        // Just fix the DB — no re-upload needed
        await updateDB(rec, newUrl);
        await supabase.storage.from('videokyc-recordings').remove([storagePath]);
        console.log(`  [DB-ONLY] ${storagePath}`);
        dbOnly++;
      } else {
        // Full migrate: download → upload → update DB → delete
        const { data: fileData, error: dlErr } = await supabase.storage
          .from('videokyc-recordings')
          .download(storagePath);
        if (dlErr) throw new Error(`Download failed: ${dlErr.message}`);

        const uint8Array = new Uint8Array(await fileData.arrayBuffer());
        const uploadedUrl = await uploadToR2(r2Key, uint8Array, 'video/webm');
        await updateDB(rec, uploadedUrl);
        await supabase.storage.from('videokyc-recordings').remove([storagePath]);
        console.log(`  [MIGRATED] ${storagePath}`);
        fullMigrate++;
      }
    } catch (err) {
      console.error(`  [FAIL] ${storagePath}: ${err.message}`);
      failed++;
    }
  }));

  console.log(`Progress: ${Math.min(i + BATCH_SIZE, recordings.length)}/${recordings.length} | DB-only: ${dbOnly} | Migrated: ${fullMigrate} | Failed: ${failed}`);
}

console.log(`\nDone. DB-only updates: ${dbOnly}, Fresh migrations: ${fullMigrate}, Failed: ${failed}`);
