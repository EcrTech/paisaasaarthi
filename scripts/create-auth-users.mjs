import { createClient } from '@supabase/supabase-js';

const TARGET_URL = 'https://newvgnbygvtnmyomxbmu.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ld3ZnbmJ5Z3Z0bm15b214Ym11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NjgxMiwiZXhwIjoyMDg4NzYyODEyfQ.zPNhU6QSr7I-En5-cFZEH3DguW3_yLkyhYp7M9XCTMk';

const supabase = createClient(TARGET_URL, TARGET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log('Creating auth users from synced profiles...\n');

  // Get all profiles (already synced from source)
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, phone, avatar_url, org_id');

  if (error) {
    console.error('Failed to fetch profiles:', error.message);
    return;
  }

  console.log(`Found ${profiles.length} profiles\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const profile of profiles) {
    if (!profile.email) {
      console.log(`  Skipping profile ${profile.id} — no email`);
      skipped++;
      continue;
    }

    try {
      // Check if user already exists
      const { data: existing } = await supabase.auth.admin.getUserById(profile.id);
      if (existing?.user) {
        console.log(`  Exists: ${profile.email}`);
        skipped++;
        continue;
      }
    } catch (e) {
      // User doesn't exist — proceed to create
    }

    // Create auth user with the SAME ID as the profile
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      id: profile.id,
      email: profile.email,
      email_confirm: true,
      password: 'TempReset@2026!',
      user_metadata: {
        full_name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
        avatar_url: profile.avatar_url || '',
      },
    });

    if (createErr) {
      if (createErr.message?.includes('already been registered')) {
        console.log(`  Already registered: ${profile.email}`);
        skipped++;
      } else {
        console.error(`  FAILED: ${profile.email} — ${createErr.message}`);
        errors++;
      }
    } else {
      console.log(`  Created: ${profile.email} (id: ${profile.id})`);
      created++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Results: ${created} created, ${skipped} skipped, ${errors} errors`);
  console.log(`${'═'.repeat(50)}`);

  if (created > 0) {
    console.log(`\nAll new users have temp password: TempReset@2026!`);
    console.log(`Users should reset their password via "Forgot Password" flow.`);
  }
}

main().catch(console.error);
