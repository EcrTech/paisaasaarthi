/**
 * Phase 1: Fix wrong Content-Type on image files in R2.
 *
 * Root cause: migrate-loan-docs-to-r2.mjs uploaded ALL files with
 * Content-Type: application/pdf, including JPEGs and PNGs.
 * This breaks image previews in the browser.
 *
 * Fix: For every loan_document whose mime_type is image/* and whose
 * file_path is an R2 URL, download the file and re-upload to the same
 * R2 key with the correct Content-Type.
 *
 * Safe to re-run — checks current Content-Type before re-uploading.
 *
 * Run: node scripts/fix-image-content-types.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';

const SUPABASE_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';

const R2_ACCOUNT_ID = 'd58b54ae5a23bd00df9ff399e1e34c0e';
const R2_ACCESS_KEY_ID = '895145c9b16c145e9bab27589e5bd9ec';
const R2_SECRET_ACCESS_KEY = 'b7673c0ed50c019642f758fc0d34a01d65c1ec55ab19dd7cc87aa92b4b0be117';
const R2_BUCKET = 'paisaasaarthi';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_BASE = 'https://pub-45f68799e99e40dba88b93e0f65da4bc.r2.dev';

const BATCH_SIZE = 8; // concurrent uploads

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3' });

// Fetch all rows paginated
async function fetchAll(table, select, filters = []) {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + PAGE - 1);
    for (const [m, ...args] of filters) q = q[m](...args);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// Get current Content-Type from R2 without downloading the whole file
async function getR2ContentType(url) {
  const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
  if (!res.ok && res.status !== 206) return null;
  // Drain to avoid hanging connections
  await res.body?.cancel();
  return res.headers.get('content-type');
}

// Re-upload a file to R2 with correct Content-Type
async function fixContentType(r2Url, correctMimeType) {
  // 1. Download full file from R2
  const dlRes = await fetch(r2Url);
  if (!dlRes.ok) throw new Error(`Download failed [${dlRes.status}]`);
  const body = new Uint8Array(await dlRes.arrayBuffer());

  // 2. Derive R2 key from public URL  (strip base + leading slash)
  const key = r2Url.slice(R2_PUBLIC_BASE.length + 1);

  // 3. Re-upload to same key with correct Content-Type
  const putRes = await r2.fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': correctMimeType,
      'Content-Length': String(body.byteLength),
    },
    body,
  });
  if (!putRes.ok) throw new Error(`Upload failed [${putRes.status}]: ${await putRes.text()}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Fetching image documents from DB...');
const rows = await fetchAll('loan_documents', 'id, file_path, mime_type, document_type', [
  ['not', 'file_path', 'is', null],
  ['not', 'mime_type', 'is', null],
]);

const imageRows = rows.filter(r =>
  r.mime_type.startsWith('image/') && r.file_path.startsWith(R2_PUBLIC_BASE)
);

console.log(`Total loan_documents: ${rows.length}`);
console.log(`Image files in R2 to check/fix: ${imageRows.length}\n`);

let fixed = 0, alreadyOk = 0, failed = 0;

// Process in batches
for (let i = 0; i < imageRows.length; i += BATCH_SIZE) {
  const batch = imageRows.slice(i, i + BATCH_SIZE);

  await Promise.all(batch.map(async (row) => {
    try {
      const current = await getR2ContentType(row.file_path);

      if (current && current.startsWith(row.mime_type.split(';')[0].trim())) {
        alreadyOk++;
        return; // Already correct
      }

      await fixContentType(row.file_path, row.mime_type);
      fixed++;
    } catch (err) {
      failed++;
      console.error(`  FAIL [${row.document_type}] ${row.id}: ${err.message}`);
    }
  }));

  const done = Math.min(i + BATCH_SIZE, imageRows.length);
  process.stdout.write(`\r  Progress: ${done}/${imageRows.length} (fixed: ${fixed}, ok: ${alreadyOk}, failed: ${failed})`);
}

console.log(`\n\nDone.`);
console.log(`  Fixed (re-uploaded):  ${fixed}`);
console.log(`  Already correct:      ${alreadyOk}`);
console.log(`  Failed:               ${failed}`);
