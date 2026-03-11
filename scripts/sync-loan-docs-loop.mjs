// Repeatedly call the Lovable sync edge function for loan-documents
// Each call syncs some files before the edge function times out
// Files already uploaded persist (upsert:true), so we make progress each run

const SYNC_URL = 'https://xopuasvbypkiszcqgdwm.supabase.co/functions/v1/sync-to-backup';
const MAX_RUNS = 50;
const TIMEOUT_MS = 150_000; // 2.5 min per attempt

async function runSync(attempt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncTables: false,
        syncStorage: true,
        buckets: ['loan-documents'],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const data = await res.json();

    const result = data.storageDetails?.[0];
    if (result) {
      console.log(`  Run ${attempt}: ${result.filesSynced} files synced (status: ${result.status})`);
      return result;
    } else {
      console.log(`  Run ${attempt}: No storage details in response`);
      return null;
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      console.log(`  Run ${attempt}: Edge function timed out (files synced so far are kept)`);
    } else {
      console.log(`  Run ${attempt}: Error — ${err.message}`);
    }
    return null;
  }
}

async function main() {
  console.log('Syncing loan-documents via Lovable edge function (repeated calls)');
  console.log('Each call processes files until timeout. Progress accumulates.\n');

  let totalSynced = 0;
  let consecutiveZeros = 0;

  for (let i = 1; i <= MAX_RUNS; i++) {
    const result = await runSync(i);

    if (result?.status === 'success' && result.filesSynced > 0) {
      totalSynced += result.filesSynced;
      consecutiveZeros = 0;
      console.log(`  Cumulative: ~${totalSynced} files\n`);
    } else if (result?.status === 'success' && result.filesSynced === 0) {
      console.log('  All files already synced!');
      break;
    } else {
      consecutiveZeros++;
      // Even on timeout, some files may have been synced silently
      console.log(`  (files may still have been transferred before timeout)\n`);

      if (consecutiveZeros >= 3) {
        console.log('  3 consecutive timeouts without confirmed progress.');
        console.log('  Files are likely still being transferred. Continuing...\n');
        consecutiveZeros = 0;
      }
    }

    // Brief pause between calls
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\nDone. Approximately ${totalSynced} files confirmed synced.`);
  console.log('(More may have been synced during timed-out runs)');
}

main().catch(console.error);
