import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user token
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = user.id;

    // Service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get user's org_id from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.org_id) {
      return new Response(JSON.stringify({ error: 'User profile or org not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const orgId = profile.org_id;
    const { rows, assignmentStrategy = 'unassigned' } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No rows provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (rows.length > 500) {
      return new Response(JSON.stringify({ error: 'Maximum 500 rows allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cache for CSV-based email-to-userId lookups
    const emailToUserCache = new Map<string, string | null>();

    // Lookup user by email in the org
    async function resolveUserByEmail(email: string): Promise<string | null> {
      if (!email) return null;
      const normalized = email.trim().toLowerCase();
      if (emailToUserCache.has(normalized)) return emailToUserCache.get(normalized)!;

      const { data } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('org_id', orgId)
        .ilike('email', normalized)
        .maybeSingle();

      const uid = data?.id || null;
      emailToUserCache.set(normalized, uid);
      return uid;
    }

    // Round-robin: get next assignee using existing DB function
    async function getNextAssignee(): Promise<string | null> {
      try {
        const { data, error } = await supabase.rpc('get_next_assignee', { p_org_id: orgId });
        if (error) {
          console.error('Round-robin error:', error.message);
          return null;
        }
        return data || null;
      } catch (e) {
        console.error('Round-robin exception:', e);
        return null;
      }
    }

    const results = { created: 0, skipped: 0, assigned: 0, assignment_failures: 0, errors: [] as string[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const phone = (row.phone || '').trim().replace(/\D/g, '').slice(-10);
        const nameParts = (row.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || null;
        const email = row.email?.trim() || null;
        const loanAmount = parseFloat(row.loan_amount || '') || 25000;
        const source = row.source?.trim() || 'bulk_upload';

        if (!firstName || !phone) {
          results.errors.push(`Row ${i + 2}: Missing name or phone`);
          continue;
        }

        // Dedup by phone
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('org_id', orgId)
          .eq('phone', phone)
          .maybeSingle();

        let contactId: string;

        if (existing) {
          contactId = existing.id;
          results.skipped++;
        } else {
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              org_id: orgId,
              first_name: firstName,
              last_name: lastName,
              phone,
              email,
              source: 'bulk_upload',
              status: 'new',
              created_by: userId,
            })
            .select('id')
            .single();

          if (contactError) throw contactError;
          contactId = newContact.id;
        }

        // Resolve assignment
        let assignedTo: string | null = null;

        if (assignmentStrategy === 'csv') {
          const assignEmail = row.assigned_to_email?.trim();
          if (assignEmail) {
            assignedTo = await resolveUserByEmail(assignEmail);
            if (!assignedTo) {
              results.assignment_failures++;
            }
          }
        } else if (assignmentStrategy === 'round_robin') {
          assignedTo = await getNextAssignee();
          if (!assignedTo) {
            results.assignment_failures++;
          }
        }

        if (assignedTo) {
          results.assigned++;
        }

        const appNumber = `BLK-${Date.now()}-${i}`;
        const insertData: Record<string, unknown> = {
          application_number: appNumber,
          org_id: orgId,
          contact_id: contactId,
          requested_amount: loanAmount,
          tenure_days: 365,
          status: 'new',
          current_stage: 'lead',
          source,
        };

        if (assignedTo) {
          insertData.assigned_to = assignedTo;
        }

        const { error: appError } = await supabase
          .from('loan_applications')
          .insert(insertData);

        if (appError) throw appError;
        results.created++;
      } catch (err: any) {
        results.errors.push(`Row ${i + 2}: ${err.message || 'Unknown error'}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
