/**
 * Phase 3: Clean up broken file path references in the DB.
 *
 * After the R2 migration, many DB records still point to old Supabase
 * Storage paths that no longer exist. The UI shows buttons that appear
 * clickable but silently do nothing when these paths are accessed.
 *
 * This script nulls out those stale paths so the UI can show a clean
 * "not available" state rather than a broken silent failure.
 *
 * Covers:
 *   1. loan_documents.file_path       — old paths with no R2 replacement (upload_status null)
 *   2. loan_generated_documents.signed_document_path  — old paths (esigned PDFs gone)
 *   3. document_esign_requests.signed_document_path   — old paths
 *   4. loan_disbursements.proof_document_path         — old paths
 *   5. loan_verifications.response_data.report_file_path (JSONB) — old paths
 *
 * Safe to re-run — only touches rows that still have old non-R2 paths.
 *
 * Run: node scripts/cleanup-broken-references.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';

const R2_PUBLIC_BASE = 'https://pub-45f68799e99e40dba88b93e0f65da4bc.r2.dev';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const isOldPath = (v) => v && !v.startsWith('https://');

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

async function batchUpdate(table, col, ids) {
  const CHUNK = 200;
  let updated = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await sb.from(table).update({ [col]: null }).in('id', chunk);
    if (error) throw new Error(`${table}.${col}: ${error.message}`);
    updated += chunk.length;
    process.stdout.write(`\r  ${updated}/${ids.length}`);
  }
  console.log();
  return updated;
}

// ── 1. loan_documents — old paths with no file ───────────────────────────────
console.log('\n=== 1. loan_documents.file_path (old Supabase paths, upload_status null) ===');

const loanDocs = await fetchAll('loan_documents', 'id, file_path, upload_status');
const ldOld = loanDocs.filter(r => isOldPath(r.file_path) && !r.upload_status);

// Check: does this app+doctype have a newer R2 version? If yes, delete the stale row outright.
// If no R2 replacement, null out file_path so the UI shows "no file" cleanly.
const r2Docs = loanDocs.filter(r => r.file_path?.startsWith(R2_PUBLIC_BASE));
const r2Set = new Set(r2Docs.map(r => r.id)); // just IDs for now

// We'll simply null out file_path for all old-path rows (upload_status null).
// The record still exists (so doc type slot is visible), but shows no file available.
console.log(`  Found ${ldOld.length} old-path records to clean up`);
if (ldOld.length > 0) {
  const ids = ldOld.map(r => r.id);
  await batchUpdate('loan_documents', 'file_path', ids);
  console.log(`  Nulled file_path on ${ids.length} loan_documents records`);
}

// ── 2. loan_generated_documents — old signed_document_path ──────────────────
console.log('\n=== 2. loan_generated_documents.signed_document_path (old paths) ===');

const genDocs = await fetchAll('loan_generated_documents', 'id, signed_document_path');
const gdOld = genDocs.filter(r => isOldPath(r.signed_document_path));

console.log(`  Found ${gdOld.length} old signed_document_path records`);
if (gdOld.length > 0) {
  const ids = gdOld.map(r => r.id);
  await batchUpdate('loan_generated_documents', 'signed_document_path', ids);
  console.log(`  Nulled signed_document_path on ${ids.length} loan_generated_documents records`);
}

// ── 3. document_esign_requests — old signed_document_path ──────────────────
console.log('\n=== 3. document_esign_requests.signed_document_path (old paths) ===');

const esigns = await fetchAll('document_esign_requests', 'id, signed_document_path');
const esOld = esigns.filter(r => isOldPath(r.signed_document_path));

console.log(`  Found ${esOld.length} old signed_document_path records`);
if (esOld.length > 0) {
  const ids = esOld.map(r => r.id);
  await batchUpdate('document_esign_requests', 'signed_document_path', ids);
  console.log(`  Nulled signed_document_path on ${ids.length} document_esign_requests records`);
}

// ── 4. loan_disbursements — old proof_document_path ─────────────────────────
console.log('\n=== 4. loan_disbursements.proof_document_path (old paths) ===');

const disbs = await fetchAll('loan_disbursements', 'id, proof_document_path');
const disbOld = disbs.filter(r => isOldPath(r.proof_document_path));

console.log(`  Found ${disbOld.length} old proof_document_path records`);
if (disbOld.length > 0) {
  const ids = disbOld.map(r => r.id);
  await batchUpdate('loan_disbursements', 'proof_document_path', ids);
  console.log(`  Nulled proof_document_path on ${ids.length} loan_disbursements records`);
}

// ── 5. loan_verifications — old report_file_path (JSONB) ────────────────────
console.log('\n=== 5. loan_verifications.response_data.report_file_path (old paths) ===');

const verifs = await fetchAll('loan_verifications', 'id, response_data', [
  ['eq', 'verification_type', 'credit_bureau'],
  ['not', 'response_data', 'is', null],
]);

const verifOld = verifs.filter(r => {
  const path = r.response_data?.report_file_path;
  return path && !path.startsWith('https://');
});

console.log(`  Found ${verifOld.length} old report_file_path records`);
if (verifOld.length > 0) {
  // Must update JSONB field: remove report_file_path key from response_data
  const CHUNK = 50; // smaller batches for JSONB updates
  let updated = 0;
  for (let i = 0; i < verifOld.length; i += CHUNK) {
    const chunk = verifOld.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async (row) => {
      const newData = { ...row.response_data };
      delete newData.report_file_path;
      const { error } = await sb.from('loan_verifications')
        .update({ response_data: newData })
        .eq('id', row.id);
      if (error) console.error(`  FAIL ${row.id}: ${error.message}`);
      else updated++;
    }));
    process.stdout.write(`\r  ${Math.min(i + CHUNK, verifOld.length)}/${verifOld.length}`);
  }
  console.log();
  console.log(`  Removed report_file_path from ${updated} loan_verifications records`);
}

console.log('\n✅ Cleanup complete.');
console.log('   Broken references have been nulled out.');
console.log('   UI will now show "not available" cleanly instead of silent failures.');
