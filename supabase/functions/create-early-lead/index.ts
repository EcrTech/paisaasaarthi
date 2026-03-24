import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Normalize phone to last 10 digits for consistent dedup
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    // 24-hour IP rate limit: only one application per IP per day
    if (clientIP && clientIP !== 'unknown') {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentAppFromIP } = await supabase
        .from('loan_applications')
        .select('id')
        .eq('submitted_from_ip', clientIP)
        .neq('status', 'draft')
        .neq('status', 'rejected')
        .gte('created_at', twentyFourHoursAgo)
        .limit(1)
        .maybeSingle();

      if (recentAppFromIP) {
        console.log(`[create-early-lead] 24h IP limit: ${clientIP} already has a recent application`);
        return new Response(
          JSON.stringify({ success: false, ipLimited: true, message: 'An application has already been submitted from this device in the last 24 hours.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const body = await req.json();
    const { name, loanAmount, referralCode, source, geolocation } = body;
    const phone = normalizePhone(body.phone || '');

    console.log('[create-early-lead] Processing early lead:', { phone, referralCode, loanAmount });

    // Validate required fields
    if (!name?.trim() || !phone?.trim() || !referralCode?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, phone, referralCode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up referral code to get org_id and referrer user_id
    const { data: referralData, error: refError } = await supabase
      .from('user_referral_codes')
      .select('user_id, org_id')
      .eq('referral_code', referralCode)
      .eq('is_active', true)
      .single();

    if (refError || !referralData) {
      console.log('[create-early-lead] Invalid referral code:', referralCode);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired referral code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = referralData.org_id;
    const referrerUserId = referralData.user_id;

    // Parse name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Check for existing contact with same phone (deduplication)
    // Use flexible matching: exact, with +91 prefix, or last-10-digit suffix
    const phone10 = phone.slice(-10);
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .or(`phone.eq.${phone10},phone.eq.+91${phone10},phone.eq.91${phone10}`)
      .limit(1)
      .maybeSingle();

    let contactId = existingContact?.id;

    if (!existingContact) {
      // Create new contact with status 'new'
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          org_id: orgId,
          first_name: firstName,
          last_name: lastName || null,
          phone: phone,
          source: source || 'referral_link',
          status: 'new',
          referred_by: referrerUserId || null,
          notes: 'Early lead from Step 1 completion',
          latitude: geolocation?.latitude || null,
          longitude: geolocation?.longitude || null,
        })
        .select('id')
        .single();

      if (contactError) {
        console.error('[create-early-lead] Error creating contact:', contactError);
        return new Response(
          JSON.stringify({ error: 'Failed to create lead' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      contactId = newContact.id;
      console.log('[create-early-lead] Created new contact:', contactId);
    } else {
      // Update existing contact to status 'new' if it's not already
      await supabase
        .from('contacts')
        .update({ status: 'new', first_name: firstName, last_name: lastName || null })
        .eq('id', contactId);
      console.log('[create-early-lead] Updated existing contact to new status:', contactId);
    }

    // Check if there's already a draft application for this contact
    const { data: existingDraft } = await supabase
      .from('loan_applications')
      .select('id')
      .eq('contact_id', contactId)
      .eq('status', 'draft')
      .eq('org_id', orgId)
      .maybeSingle();

    let draftApplicationId = existingDraft?.id;

    if (!existingDraft) {
      // Create draft loan application
      const draftAppNumber = `DRAFT-${Date.now().toString(36).toUpperCase()}`;
      
      const { data: newApp, error: appError } = await supabase
        .from('loan_applications')
        .insert({
          org_id: orgId,
          application_number: draftAppNumber,
          product_type: 'personal_loan',
          requested_amount: loanAmount || 25000,
          tenure_days: 30,
          tenure_months: 1,
          current_stage: 'lead',
          status: 'draft',
          source: source || 'referral_link',
          referred_by: referrerUserId,
          contact_id: contactId,
          latitude: geolocation?.latitude || null,
          longitude: geolocation?.longitude || null,
          geolocation_accuracy: geolocation?.accuracy || null,
        })
        .select('id')
        .single();

      if (appError) {
        console.error('[create-early-lead] Error creating draft application:', appError);
        // Don't fail the whole request - the contact was still created
        return new Response(
          JSON.stringify({ success: true, contactId, draftApplicationId: null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      draftApplicationId = newApp.id;
      console.log('[create-early-lead] Created draft application:', draftApplicationId);
    } else {
      console.log('[create-early-lead] Existing draft found:', draftApplicationId);
    }

    // Assign using round-robin
    try {
      const { data: assigneeId } = await supabase.rpc('get_next_assignee', {
        p_org_id: orgId
      });
      
      if (assigneeId && draftApplicationId) {
        await supabase
          .from('loan_applications')
          .update({ assigned_to: assigneeId })
          .eq('id', draftApplicationId);
        console.log('[create-early-lead] Assigned to:', assigneeId);
      }
    } catch (assignError) {
      console.log('[create-early-lead] Round-robin assignment skipped');
    }

    console.log('[create-early-lead] Early lead created successfully:', { contactId, draftApplicationId });

    return new Response(
      JSON.stringify({ success: true, contactId, draftApplicationId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[create-early-lead] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
