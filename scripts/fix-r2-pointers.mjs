/**
 * Fix R2 DB pointers — updates old Supabase paths to R2 URLs
 * for rows where the file already exists in R2.
 *
 * Covers:
 *   1. loan_disbursements.proof_document_path  (84 rows)
 *   2. loan_verifications.response_data.report_file_path  (157 rows)
 *   3. loan_documents.file_path  (4 rows)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';
const R2_PUBLIC_BASE = 'https://pub-45f68799e99e40dba88b93e0f65da4bc.r2.dev';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const isR2 = v => v && v.startsWith(R2_PUBLIC_BASE);

async function existsInR2(path) {
  const res = await fetch(`${R2_PUBLIC_BASE}/loan-docs/${path}`, { method: 'HEAD' });
  return res.ok;
}

function toR2Url(path) {
  return `${R2_PUBLIC_BASE}/loan-docs/${path}`;
}

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

// ── 1. loan_disbursements ─────────────────────────────────────────────────────
console.log('\n=== loan_disbursements.proof_document_path ===');
const disbs = await fetchAll('loan_disbursements', 'id, proof_document_path', [
  ['not', 'proof_document_path', 'is', null],
]);
const disbsToFix = disbs.filter(r => !isR2(r.proof_document_path));
console.log(`Total non-null: ${disbs.length}, old paths: ${disbsToFix.length}`);

let disbOk = 0, disbSkipped = 0;
for (const row of disbsToFix) {
  if (await existsInR2(row.proof_document_path)) {
    const { error } = await sb.from('loan_disbursements')
      .update({ proof_document_path: toR2Url(row.proof_document_path) })
      .eq('id', row.id);
    if (error) { console.error(`  FAIL ${row.id}: ${error.message}`); continue; }
    disbOk++;
    process.stdout.write(`\r  Updated: ${disbOk}`);
  } else {
    disbSkipped++;
  }
}
console.log(`\n  ✓ Updated: ${disbOk}, skipped (not in R2): ${disbSkipped}`);

// ── 2. loan_verifications (credit_bureau) ─────────────────────────────────────
console.log('\n=== loan_verifications.response_data.report_file_path ===');
const verifs = await fetchAll('loan_verifications', 'id, response_data', [
  ['in', 'verification_type', ['credit_bureau']],
  ['not', 'response_data', 'is', null],
]);
const verifsToFix = verifs.filter(r =>
  r.response_data?.report_file_path && !isR2(r.response_data.report_file_path)
);
console.log(`Total credit_bureau: ${verifs.length}, old paths: ${verifsToFix.length}`);

let verifOk = 0, verifSkipped = 0;
for (const row of verifsToFix) {
  const path = row.response_data.report_file_path;
  if (await existsInR2(path)) {
    const { error } = await sb.from('loan_verifications')
      .update({ response_data: { ...row.response_data, report_file_path: toR2Url(path) } })
      .eq('id', row.id);
    if (error) { console.error(`  FAIL ${row.id}: ${error.message}`); continue; }
    verifOk++;
    process.stdout.write(`\r  Updated: ${verifOk}`);
  } else {
    verifSkipped++;
  }
}
console.log(`\n  ✓ Updated: ${verifOk}, skipped (not in R2): ${verifSkipped}`);

// ── 3. loan_documents ─────────────────────────────────────────────────────────
console.log('\n=== loan_documents.file_path ===');
const loanDocs = await fetchAll('loan_documents', 'id, file_path', [
  ['not', 'file_path', 'is', null],
]);
const loanDocsToFix = loanDocs.filter(r => !isR2(r.file_path));
console.log(`Total non-null: ${loanDocs.length}, old paths: ${loanDocsToFix.length}`);

let ldOk = 0, ldSkipped = 0;
for (const row of loanDocsToFix) {
  if (await existsInR2(row.file_path)) {
    const { error } = await sb.from('loan_documents')
      .update({ file_path: toR2Url(row.file_path) })
      .eq('id', row.id);
    if (error) { console.error(`  FAIL ${row.id}: ${error.message}`); continue; }
    ldOk++;
    process.stdout.write(`\r  Updated: ${ldOk}`);
  } else {
    ldSkipped++;
  }
}
console.log(`\n  ✓ Updated: ${ldOk}, skipped (not in R2): ${ldSkipped}`);

console.log('\n✅ Pointer fix complete.');
