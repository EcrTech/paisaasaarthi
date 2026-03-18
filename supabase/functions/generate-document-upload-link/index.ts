import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    // Verify the calling user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { applicationId, expiryDays = 7 } = body;

    if (!applicationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'applicationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user's org
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get application details and verify org
    const { data: application } = await supabase
      .from('loan_applications')
      .select('id, org_id')
      .eq('id', applicationId)
      .eq('org_id', profile.org_id)
      .single();

    if (!application) {
      return new Response(
        JSON.stringify({ success: false, error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get applicant info
    const { data: applicant } = await supabase
      .from('loan_applicants')
      .select('first_name, last_name, mobile, email')
      .eq('loan_application_id', applicationId)
      .limit(1)
      .maybeSingle();

    // Also check contacts
    const { data: appWithContact } = await supabase
      .from('loan_applications')
      .select('contacts(first_name, last_name, phone, email)')
      .eq('id', applicationId)
      .single();

    const contact = (appWithContact as any)?.contacts;

    const applicantName = applicant
      ? `${applicant.first_name || ''} ${applicant.last_name || ''}`.trim()
      : contact
        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
        : 'Applicant';
    const applicantPhone = applicant?.mobile || contact?.phone || null;
    const applicantEmail = applicant?.email || contact?.email || null;

    // Check for existing active token
    const { data: existingToken } = await supabase
      .from('document_upload_tokens')
      .select('*')
      .eq('loan_application_id', applicationId)
      .in('status', ['active', 'accessed'])
      .gt('token_expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingToken) {
      // Return existing active token
      const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.paisasaarthi.com';
      return new Response(
        JSON.stringify({
          success: true,
          token: existingToken.access_token,
          url: `${frontendUrl}/upload-documents/${existingToken.access_token}`,
          expires_at: existingToken.token_expires_at,
          is_existing: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const { data: newToken, error: insertError } = await supabase
      .from('document_upload_tokens')
      .insert({
        loan_application_id: applicationId,
        org_id: profile.org_id,
        token_expires_at: expiresAt.toISOString(),
        applicant_name: applicantName,
        applicant_phone: applicantPhone,
        applicant_email: applicantEmail,
        created_by: user.id,
      })
      .select('access_token, token_expires_at')
      .single();

    if (insertError || !newToken) {
      console.error('[generate-document-upload-link] Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate upload link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.paisasaarthi.com';
    const uploadUrl = `${frontendUrl}/upload-documents/${newToken.access_token}`;

    console.log(`[generate-document-upload-link] Generated link for application ${applicationId}: ${uploadUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        token: newToken.access_token,
        url: uploadUrl,
        expires_at: newToken.token_expires_at,
        is_existing: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[generate-document-upload-link] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
