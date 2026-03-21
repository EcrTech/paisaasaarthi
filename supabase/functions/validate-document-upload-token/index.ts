import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token is required', status: 'not_found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up token
    const { data: tokenData, error: tokenError } = await supabase
      .from('document_upload_tokens')
      .select('*')
      .eq('access_token', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid or unknown link', status: 'not_found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(tokenData.token_expires_at);
    if (now > expiresAt) {
      await supabase
        .from('document_upload_tokens')
        .update({ status: 'expired' })
        .eq('id', tokenData.id);

      return new Response(
        JSON.stringify({ valid: false, error: 'This link has expired', status: 'expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already completed
    if (tokenData.status === 'completed') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Documents have already been submitted',
          status: 'completed',
          completed_at: tokenData.completed_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // One-time use: block if link was already opened
    if (tokenData.status === 'accessed') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'This link has already been used',
          status: 'completed',
          completed_at: tokenData.accessed_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch existing documents for this application
    const { data: existingDocs } = await supabase
      .from('loan_documents')
      .select('id, document_type, document_category, file_name, upload_status, parsing_status')
      .eq('loan_application_id', tokenData.loan_application_id);

    // Update access tracking
    const updateData: Record<string, any> = {
      access_count: (tokenData.access_count || 0) + 1,
      status: 'accessed',
    };
    if (!tokenData.accessed_at) {
      updateData.accessed_at = now.toISOString();
    }
    await supabase
      .from('document_upload_tokens')
      .update(updateData)
      .eq('id', tokenData.id);

    return new Response(
      JSON.stringify({
        valid: true,
        status: 'active',
        application_id: tokenData.loan_application_id,
        org_id: tokenData.org_id,
        applicant_name: tokenData.applicant_name,
        existing_documents: existingDocs || [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[validate-document-upload-token] Error:', err);
    return new Response(
      JSON.stringify({ valid: false, error: err.message || 'Internal server error', status: 'error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
