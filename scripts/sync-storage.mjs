import { createClient } from '@supabase/supabase-js';

// Source — anon key is enough for public buckets
const SOURCE_URL = 'https://xopuasvbypkiszcqgdwm.supabase.co';
const SOURCE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvcHVhc3ZieXBraXN6Y3FnZHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNDQwODYsImV4cCI6MjA3OTkyMDA4Nn0.1wkn0xQoWXi_ZV_vViOHiH59oz6E2c_qHEiOI6eWIZE';

// Target — service role key for uploads
const TARGET_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';

const BUCKET = process.argv[2] || 'whatsapp-media';

const source = createClient(SOURCE_URL, SOURCE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const target = createClient(TARGET_URL, TARGET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listAllFiles(client, bucket, path = '') {
  const allFiles = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(path, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      console.error(`  List error at ${path}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;

    for (const item of data) {
      const fullPath = path ? `${path}/${item.name}` : item.name;
      if (item.id) {
        allFiles.push({ ...item, name: fullPath });
      } else {
        // It's a folder — recurse
        const subFiles = await listAllFiles(client, bucket, fullPath);
        allFiles.push(...subFiles);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return allFiles;
}

async function syncFile(file, bucket) {
  // Download from source
  const { data: fileData, error: dlErr } = await source.storage
    .from(bucket)
    .download(file.name);

  if (dlErr || !fileData) {
    return { success: false, error: `Download: ${dlErr?.message}` };
  }

  // Upload to target
  const { error: upErr } = await target.storage
    .from(bucket)
    .upload(file.name, fileData, {
      upsert: true,
      contentType: file.metadata?.mimetype || 'application/octet-stream',
    });

  if (upErr) {
    return { success: false, error: `Upload: ${upErr.message}` };
  }

  return { success: true };
}

async function main() {
  console.log(`\nSyncing storage bucket: ${BUCKET}`);
  console.log('─'.repeat(50));

  console.log('Listing files...');
  const files = await listAllFiles(source, BUCKET);
  console.log(`Found ${files.length} files\n`);

  if (files.length === 0) {
    console.log('No files to sync.');
    return;
  }

  let synced = 0;
  let errors = 0;
  const CONCURRENCY = 3;

  // Process in batches for concurrency
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(f => syncFile(f, BUCKET))
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const file = batch[j];
      if (r.status === 'fulfilled' && r.value.success) {
        synced++;
      } else {
        const errMsg = r.status === 'fulfilled' ? r.value.error : r.reason;
        console.error(`\n  FAIL: ${file.name} — ${errMsg}`);
        errors++;
      }
    }

    process.stdout.write(`\r  Progress: ${synced + errors}/${files.length} (${synced} ok, ${errors} errors)`);
  }

  console.log(`\n\n${'═'.repeat(50)}`);
  console.log(`${BUCKET}: ${synced} files synced, ${errors} errors`);
  console.log('═'.repeat(50));
}

main().catch(console.error);
