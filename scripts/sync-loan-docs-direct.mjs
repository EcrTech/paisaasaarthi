import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Source — anon key (downloads work for public bucket)
const SOURCE_URL = 'https://xopuasvbypkiszcqgdwm.supabase.co';
const SOURCE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvcHVhc3ZieXBraXN6Y3FnZHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNDQwODYsImV4cCI6MjA3OTkyMDA4Nn0.1wkn0xQoWXi_ZV_vViOHiH59oz6E2c_qHEiOI6eWIZE';

// Target — service role key
const TARGET_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';

const BUCKET = 'loan-documents';
const CONCURRENCY = 5;

const source = createClient(SOURCE_URL, SOURCE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const target = createClient(TARGET_URL, TARGET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Load known paths
const paths = JSON.parse(readFileSync('scripts/loan-doc-paths.json', 'utf8'));
console.log(`Loaded ${paths.length} file paths to sync\n`);

// First, get list of files already on target
async function listTargetFiles(path = '') {
  const allFiles = new Set();
  const { data, error } = await target.storage.from(BUCKET).list(path, {
    limit: 1000, sortBy: { column: 'name', order: 'asc' }
  });
  if (error || !data) return allFiles;
  for (const item of data) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    if (item.id) allFiles.add(fullPath);
    else {
      const sub = await listTargetFiles(fullPath);
      sub.forEach(f => allFiles.add(f));
    }
  }
  return allFiles;
}

console.log('Checking existing files on target...');
const existing = await listTargetFiles();
console.log(`Already on target: ${existing.size} files`);

// Filter to only files not yet synced
const toSync = paths.filter(p => !existing.has(p));
console.log(`Need to sync: ${toSync.length} files\n`);

if (toSync.length === 0) {
  console.log('All known files already synced!');
  process.exit(0);
}

let synced = 0;
let errors = 0;
let skipped = 0;

async function syncFile(filePath) {
  try {
    const { data: fileData, error: dlErr } = await source.storage.from(BUCKET).download(filePath);
    if (dlErr || !fileData) {
      console.error(`\n  DL FAIL: ${filePath} — ${dlErr?.message || 'no data'}`);
      errors++;
      return;
    }

    const ext = filePath.split('.').pop().toLowerCase();
    const mimeMap = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      pdf: 'application/pdf', webm: 'video/webm', mp4: 'video/mp4',
      doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const { error: upErr } = await target.storage.from(BUCKET).upload(filePath, fileData, {
      upsert: true,
      contentType: mimeMap[ext] || 'application/octet-stream',
    });

    if (upErr) {
      console.error(`\n  UP FAIL: ${filePath} — ${upErr.message}`);
      errors++;
      return;
    }

    synced++;
    process.stdout.write(`\r  Progress: ${synced + errors}/${toSync.length} (${synced} ok, ${errors} errors)`);
  } catch (err) {
    console.error(`\n  ERROR: ${filePath} — ${err.message}`);
    errors++;
  }
}

// Process in batches for concurrency
for (let i = 0; i < toSync.length; i += CONCURRENCY) {
  const batch = toSync.slice(i, i + CONCURRENCY);
  await Promise.allSettled(batch.map(f => syncFile(f)));
}

console.log(`\n\n${'═'.repeat(50)}`);
console.log(`loan-documents: ${synced} files synced, ${errors} errors`);
console.log(`(${existing.size} were already on target)`);
console.log('═'.repeat(50));
