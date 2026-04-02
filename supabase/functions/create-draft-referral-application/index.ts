import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { referralCode, basicInfo, panNumber, aadhaarNumber, aadhaarData, panData } = body;

    console.log('[CreateDraftReferralApp] Starting with referral code:', referralCode);

    // Validate referral code and get org_id
    const { data: referralData, error: refError } = await supabase
      .from('user_referral_codes')
      .select('user_id, org_id')
      .eq('referral_code', referralCode)
      .eq('is_active', true)
      .single();

    if (refError || !referralData) {
      console.error('[CreateDraftReferralApp] Invalid referral code:', refError);
      return new Response(
        JSON.stringify({ error: 'Invalid referral code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CreateDraftReferralApp] Referral validated, org_id:', referralData.org_id);

    // Generate a temporary application number for draft
    const tempAppNumber = `DRAFT-${Date.now()}`;

    // Create draft application using service role (bypasses RLS)
    const { data: draft, error: draftError } = await supabase
      .from('loan_applications')
      .insert({
        org_id: referralData.org_id,
        referred_by: referralData.user_id,
        requested_amount: basicInfo.requestedAmount,
        tenure_days: basicInfo.tenureDays,
        interest_rate: 1, // 1% daily interest rate
        status: 'draft',
        current_stage: 'application',
        application_number: tempAppNumber,
        source: 'referral',
      })
      .select('id')
      .single();

    if (draftError) {
      console.error('[CreateDraftReferralApp] Error creating draft:', draftError);
      return new Response(
        JSON.stringify({ error: 'Failed to create draft application', details: draftError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CreateDraftReferralApp] Draft application created:', draft.id);

    // Create loan applicant record with personal details
    const nameParts = (basicInfo.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Helper function to check if DOB is a valid date (not placeholder)
    const isValidDob = (dob: string | undefined) => {
      return dob && dob !== 'DOB verified' && /^\d{4}-\d{2}-\d{2}$/.test(dob);
    };

    // Extract DOB - prioritize Aadhaar DOB, then PAN DOB, then default
    let dob = '1990-01-01';
    if (isValidDob(aadhaarData?.dob)) {
      dob = aadhaarData.dob;
    } else if (isValidDob(panData?.dob)) {
      dob = panData.dob;
    }

    // Extract gender from Aadhaar data
    const gender = aadhaarData?.gender || null;

    // Build current_address JSONB from structured Aadhaar address data
    let currentAddress = null;
    if (aadhaarData?.addressData) {
      currentAddress = {
        line1: aadhaarData.addressData.line1 || '',
        line2: aadhaarData.addressData.line2 || '',
        city: aadhaarData.addressData.city || '',
        state: aadhaarData.addressData.state || '',
        pincode: aadhaarData.addressData.pincode || '',
      };
    }

    console.log('[CreateDraftReferralApp] Extracted data - DOB:', dob, 'Gender:', gender, 'Has Address:', !!currentAddress);

    const { error: applicantError } = await supabase
      .from('loan_applicants')
      .insert({
        loan_application_id: draft.id,
        applicant_type: 'primary',
        first_name: firstName,
        last_name: lastName || null,
        mobile: basicInfo.phone,
        email: basicInfo.email || null,
        pan_number: panNumber?.toUpperCase() || null,
        aadhaar_number: aadhaarNumber?.replace(/\s/g, '') || null,
        dob: dob,
        gender: gender,
        current_address: currentAddress,
      });

    if (applicantError) {
      console.error('[CreateDraftReferralApp] Error creating loan applicant:', applicantError);
      // Don't fail the whole process - application is already created
    } else {
      console.log('[CreateDraftReferralApp] Loan applicant created for application:', draft.id);
    }

    return new Response(
      JSON.stringify({ success: true, draftId: draft.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CreateDraftReferralApp] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create draft application' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
