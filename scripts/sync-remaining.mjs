import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Source (Lovable)
const SOURCE_URL = 'https://xopuasvbypkiszcqgdwm.supabase.co';
const SOURCE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvcHVhc3ZieXBraXN6Y3FnZHdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM0NDA4NiwiZXhwIjoyMDc5OTIwMDg2fQ.odSGFwIOCbPKpgT2jS98IVxnvMo_3MrKKCRddkgZPjQ'; // placeholder

// Target (PaisaaSaarthi)
const TARGET_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';

const BATCH_SIZE = 500;

const source = createClient(SOURCE_URL, SOURCE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const target = createClient(TARGET_URL, TARGET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── 1. Sync large tables ───────────────────────────────────────────
async function syncTable(tableName) {
  console.log(`\n📋 Syncing table: ${tableName}`);

  const { count, error: countErr } = await source
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error(`  ❌ Count error: ${countErr.message}`);
    return;
  }

  const totalRows = count || 0;
  console.log(`  Total rows: ${totalRows}`);

  if (totalRows === 0) {
    console.log(`  ✅ No data to sync`);
    return;
  }

  let synced = 0;
  let offset = 0;
  let errors = 0;

  while (offset < totalRows) {
    const { data, error: fetchErr } = await source
      .from(tableName)
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id', { ascending: true });

    if (fetchErr) {
      console.error(`  ❌ Fetch error at offset ${offset}: ${fetchErr.message}`);
      // Try without ordering
      const { data: data2, error: fetchErr2 } = await source
        .from(tableName)
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1);

      if (fetchErr2 || !data2 || data2.length === 0) {
        console.error(`  ❌ Retry also failed. Skipping batch.`);
        offset += BATCH_SIZE;
        errors++;
        continue;
      }
      // Use the unordered data
      const { error: upsertErr } = await target
        .from(tableName)
        .upsert(data2, { onConflict: 'id', ignoreDuplicates: false });

      if (upsertErr) {
        console.error(`  ❌ Upsert error: ${upsertErr.message}`);
        errors++;
      } else {
        synced += data2.length;
      }
      offset += BATCH_SIZE;
      continue;
    }

    if (!data || data.length === 0) break;

    const { error: upsertErr } = await target
      .from(tableName)
      .upsert(data, { onConflict: 'id', ignoreDuplicates: false });

    if (upsertErr) {
      console.error(`  ❌ Upsert error at offset ${offset}: ${upsertErr.message}`);
      errors++;
    } else {
      synced += data.length;
    }

    offset += BATCH_SIZE;
    process.stdout.write(`\r  Progress: ${synced}/${totalRows} rows synced`);
  }

  console.log(`\n  ✅ ${tableName}: ${synced} rows synced (${errors} batch errors)`);
}

// ─── 2. Sync storage buckets ────────────────────────────────────────
async function listAllFiles(client, bucket, path = '') {
  const allFiles = [];
  const { data, error } = await client.storage.from(bucket).list(path, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error || !data) return allFiles;

  for (const item of data) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    if (item.id) {
      allFiles.push({ ...item, name: fullPath });
    } else {
      const subFiles = await listAllFiles(client, bucket, fullPath);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

async function syncBucket(bucketName) {
  console.log(`\n🗂️  Syncing storage bucket: ${bucketName}`);

  const allFiles = await listAllFiles(source, bucketName);
  console.log(`  Found ${allFiles.length} files`);

  if (allFiles.length === 0) {
    console.log(`  ✅ No files to sync`);
    return;
  }

  let synced = 0;
  let errors = 0;

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    try {
      // Download from source
      const { data: fileData, error: dlErr } = await source.storage
        .from(bucketName)
        .download(file.name);

      if (dlErr || !fileData) {
        console.error(`\n  ❌ Download failed: ${bucketName}/${file.name}: ${dlErr?.message}`);
        errors++;
        continue;
      }

      // Upload to target
      const { error: upErr } = await target.storage
        .from(bucketName)
        .upload(file.name, fileData, {
          upsert: true,
          contentType: file.metadata?.mimetype || 'application/octet-stream',
        });

      if (upErr) {
        console.error(`\n  ❌ Upload failed: ${bucketName}/${file.name}: ${upErr.message}`);
        errors++;
        continue;
      }

      synced++;
      process.stdout.write(`\r  Progress: ${synced}/${allFiles.length} files (${errors} errors)`);
    } catch (err) {
      console.error(`\n  ❌ Error: ${bucketName}/${file.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n  ✅ ${bucketName}: ${synced}/${allFiles.length} files synced (${errors} errors)`);
}

// ─── 3. Sync auth users ─────────────────────────────────────────────
async function syncAuthUsers() {
  console.log(`\n👤 Syncing auth.users`);

  // List all users from source
  let allUsers = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data: { users }, error } = await source.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error(`  ❌ Error listing users: ${error.message}`);
      break;
    }

    if (!users || users.length === 0) break;
    allUsers.push(...users);
    if (users.length < perPage) break;
    page++;
  }

  console.log(`  Found ${allUsers.length} users`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of allUsers) {
    try {
      // Check if user already exists on target
      const { data: existing } = await target.auth.admin.getUserById(user.id);

      if (existing?.user) {
        skipped++;
        continue;
      }

      // Create user on target with same ID
      const { error: createErr } = await target.auth.admin.createUser({
        id: user.id,
        email: user.email,
        phone: user.phone,
        email_confirm: true,
        phone_confirm: !!user.phone,
        password: 'TempPassword123!', // Users will need to reset
        user_metadata: user.user_metadata || {},
        app_metadata: user.app_metadata || {},
      });

      if (createErr) {
        if (createErr.message?.includes('already been registered')) {
          skipped++;
        } else {
          console.error(`\n  ❌ Failed to create ${user.email}: ${createErr.message}`);
          errors++;
        }
      } else {
        created++;
        process.stdout.write(`\r  Progress: ${created} created, ${skipped} skipped, ${errors} errors`);
      }
    } catch (err) {
      console.error(`\n  ❌ Error with ${user.email}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n  ✅ Auth users: ${created} created, ${skipped} skipped, ${errors} errors`);
  if (created > 0) {
    console.log(`  ⚠️  All new users have temp password "TempPassword123!" — they should reset via forgot password`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  PaisaaSaarthi Data Sync — Remaining Items');
  console.log('═══════════════════════════════════════════');

  // 1. Sync auth users first (needed for FK constraints)
  await syncAuthUsers();

  // 2. Sync large table
  await syncTable('dpdp_pii_access_log');

  // 3. Sync storage buckets
  await syncBucket('loan-documents');
  await syncBucket('videokyc-recordings');
  await syncBucket('whatsapp-media');

  console.log('\n═══════════════════════════════════════════');
  console.log('  Sync complete!');
  console.log('═══════════════════════════════════════════');
}

main().catch(console.error);
