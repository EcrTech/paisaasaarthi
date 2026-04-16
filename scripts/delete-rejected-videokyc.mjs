import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';
const BUCKET = 'videokyc-recordings';
const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const BATCH_SIZE = 100;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Step 1: Get all rejected application IDs
console.log('Fetching rejected loan applications...');
const { data: rejected, error: rejErr } = await supabase
  .from('loan_applications')
  .select('id')
  .eq('status', 'rejected');

if (rejErr) { console.error('Error fetching rejected apps:', rejErr); process.exit(1); }
console.log(`Found ${rejected.length} rejected applications`);

if (rejected.length === 0) {
  console.log('Nothing to delete.');
  process.exit(0);
}

const rejectedIds = rejected.map(r => r.id);

// Step 2: Get videokyc_recordings for those applications
console.log('Fetching video KYC recordings...');
const { data: recordings, error: recErr } = await supabase
  .from('videokyc_recordings')
  .select('id, application_id, recording_url')
  .in('application_id', rejectedIds)
  .not('recording_url', 'is', null);

if (recErr) { console.error('Error fetching recordings:', recErr); process.exit(1); }
console.log(`Found ${recordings.length} recordings to delete\n`);

if (recordings.length === 0) {
  console.log('No recordings found for rejected applications.');
  process.exit(0);
}

// Step 3: Extract storage paths from URLs
const storagePaths = recordings
  .map(r => {
    if (r.recording_url.startsWith(STORAGE_PREFIX)) {
      return r.recording_url.slice(STORAGE_PREFIX.length);
    }
    // Handle signed/other URL formats — extract path after bucket name
    const match = r.recording_url.match(new RegExp(`/${BUCKET}/(.+)`));
    return match ? match[1] : null;
  })
  .filter(Boolean);

console.log(`Extracted ${storagePaths.length} storage paths`);

// Step 4: Delete files from storage in batches
let deletedFiles = 0;
for (let i = 0; i < storagePaths.length; i += BATCH_SIZE) {
  const batch = storagePaths.slice(i, i + BATCH_SIZE);
  const { error: delErr } = await supabase.storage.from(BUCKET).remove(batch);
  if (delErr) {
    console.error(`Error deleting batch ${i / BATCH_SIZE + 1}:`, delErr);
  } else {
    deletedFiles += batch.length;
    console.log(`Deleted batch ${i / BATCH_SIZE + 1}: ${batch.length} files (total: ${deletedFiles})`);
  }
}

// Step 5: Clear recording_url in DB for those records
console.log('\nClearing recording_url in videokyc_recordings...');
const recordingIds = recordings.map(r => r.id);
for (let i = 0; i < recordingIds.length; i += BATCH_SIZE) {
  const batch = recordingIds.slice(i, i + BATCH_SIZE);
  const { error: updateErr } = await supabase
    .from('videokyc_recordings')
    .update({ recording_url: null })
    .in('id', batch);
  if (updateErr) console.error('Error clearing URLs:', updateErr);
}

console.log(`\nDone. Deleted ${deletedFiles} video files from storage.`);
