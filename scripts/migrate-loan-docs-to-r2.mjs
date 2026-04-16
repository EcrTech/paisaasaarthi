/**
 * Migrates existing loan-documents from Supabase Storage to Cloudflare R2.
 *
 * Covers all tables that store file paths:
 *   - loan_documents.file_path
 *   - loan_generated_documents.signed_document_path
 *   - document_esign_requests.signed_document_path
 *   - loan_verifications.response_data->>'report_file_path' (JSONB)
 *
 * Smart: checks R2 first, skips re-upload if already there.
 * Safe to re-run — skips rows already pointing to R2.
 *
 * Run: node scripts/migrate-loan-docs-to-r2.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';

const SUPABASE_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';

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
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3' });

function isR2Url(v) { return v && v.startsWith(R2_PUBLIC_BASE); }

async function existsInR2(key) {
  const res = await fetch(`${R2_PUBLIC_BASE}/${key}`, { method: 'HEAD' });
  return res.ok;
}

async function uploadToR2(key, body, contentType) {
  const res = await r2.fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(body.byteLength) },
    body,
  });
  if (!res.ok) throw new Error(`R2 [${res.status}]: ${await res.text()}`);
  return `${R2_PUBLIC_BASE}/${key}`;
}

async function migrateFile(storagePath, mimeType = 'application/pdf') {
  const r2Key = `loan-docs/${storagePath}`;
  const r2Url = `${R2_PUBLIC_BASE}/${r2Key}`;

  // Already in R2?
  if (await existsInR2(r2Key)) return r2Url;

  // Download from Supabase
  const { data, error } = await supabase.storage.from('loan-documents').download(storagePath);
  if (error) throw new Error(`Download: ${error.message}`);

  const bytes = new Uint8Array(await data.arrayBuffer());
  return await uploadToR2(r2Key, bytes, mimeType);
}

async function deleteFromSupabase(path) {
  await supabase.storage.from('loan-documents').remove([path]);
}

let ok = 0, skipped = 0, failed = 0;

async function processBatch(items, getPath, updateFn) {
  await Promise.all(items.map(async (row) => {
    const path = getPath(row);
    if (!path || isR2Url(path)) { skipped++; return; }
    try {
      const newUrl = await migrateFile(path);
      await updateFn(row, newUrl);
      await deleteFromSupabase(path);
      ok++;
    } catch (err) {
      console.error(`  [FAIL] ${path}: ${err.message}`);
      failed++;
    }
  }));
}

async function fetchAllRows(table, select, filters = []) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    for (const [method, ...args] of filters) q = q[method](...args);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── 1. loan_documents.file_path ───────────────────────────────────────────────
console.log('\n=== loan_documents ===');
const loanDocs = await fetchAllRows('loan_documents', 'id, file_path, mime_type', [['not', 'file_path', 'is', null]]);
console.log(`${loanDocs.length} rows`);
let processed = 0;
for (let i = 0; i < loanDocs.length; i += BATCH_SIZE) {
  await processBatch(loanDocs.slice(i, i + BATCH_SIZE),
    r => r.file_path,
    async (r, url) => supabase.from('loan_documents').update({ file_path: url }).eq('id', r.id)
  );
  processed = Math.min(i + BATCH_SIZE, loanDocs.length);
  process.stdout.write(`\r${processed}/${loanDocs.length}`);
}

// ── 2. loan_generated_documents.signed_document_path ─────────────────────────
console.log('\n\n=== loan_generated_documents ===');
const genDocs = await fetchAllRows('loan_generated_documents', 'id, signed_document_path', [['not', 'signed_document_path', 'is', null]]);
console.log(`${genDocs.length} rows`);
for (let i = 0; i < genDocs.length; i += BATCH_SIZE) {
  await processBatch(genDocs.slice(i, i + BATCH_SIZE),
    r => r.signed_document_path,
    async (r, url) => supabase.from('loan_generated_documents').update({ signed_document_path: url }).eq('id', r.id)
  );
  process.stdout.write(`\r${Math.min(i + BATCH_SIZE, genDocs.length)}/${genDocs.length}`);
}

// ── 3. document_esign_requests.signed_document_path ──────────────────────────
console.log('\n\n=== document_esign_requests ===');
const esignDocs = await fetchAllRows('document_esign_requests', 'id, signed_document_path', [['not', 'signed_document_path', 'is', null]]);
console.log(`${esignDocs.length} rows`);
for (let i = 0; i < esignDocs.length; i += BATCH_SIZE) {
  await processBatch(esignDocs.slice(i, i + BATCH_SIZE),
    r => r.signed_document_path,
    async (r, url) => supabase.from('document_esign_requests').update({ signed_document_path: url }).eq('id', r.id)
  );
  process.stdout.write(`\r${Math.min(i + BATCH_SIZE, esignDocs.length)}/${esignDocs.length}`);
}

// ── 4. loan_verifications.response_data->>'report_file_path' ─────────────────
console.log('\n\n=== loan_verifications (credit reports) ===');
const verifs = await fetchAllRows('loan_verifications', 'id, response_data', [
  ['in', 'verification_type', ['credit_bureau']],
  ['not', 'response_data', 'is', null],
]);
const verifWithPath = (verifs || []).filter(v => v.response_data?.report_file_path && !isR2Url(v.response_data.report_file_path));
console.log(`${verifWithPath.length} rows`);
for (let i = 0; i < verifWithPath.length; i += BATCH_SIZE) {
  await processBatch(verifWithPath.slice(i, i + BATCH_SIZE),
    r => r.response_data.report_file_path,
    async (r, url) => supabase.from('loan_verifications').update({
      response_data: { ...r.response_data, report_file_path: url }
    }).eq('id', r.id)
  );
  process.stdout.write(`\r${Math.min(i + BATCH_SIZE, verifWithPath.length)}/${verifWithPath.length}`);
}

console.log(`\n\n✓ Done. Migrated: ${ok}, Skipped (already R2): ${skipped}, Failed: ${failed}`);
