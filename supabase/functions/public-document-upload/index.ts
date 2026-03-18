import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: max 20 uploads per 15 min per IP
const ipCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Too many uploads. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // Parse multipart form data
    const formData = await req.formData();
    const token = formData.get('token') as string;
    const documentType = formData.get('document_type') as string;
    const documentCategory = formData.get('document_category') as string;
    const file = formData.get('file') as File;

    if (!token || !documentType || !documentCategory || !file) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: token, document_type, document_category, file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: 'File size exceeds 10MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only JPEG, PNG, WebP and PDF files are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('document_upload_tokens')
      .select('*')
      .eq('access_token', token)
      .eq('status', 'accessed')
      .maybeSingle();

    // Also check for 'active' status (first upload before token was marked accessed)
    let validToken = tokenData;
    if (!validToken) {
      const { data: activeToken } = await supabase
        .from('document_upload_tokens')
        .select('*')
        .eq('access_token', token)
        .eq('status', 'active')
        .maybeSingle();
      validToken = activeToken;
    }

    if (!validToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired upload link' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiry
    if (new Date() > new Date(validToken.token_expires_at)) {
      await supabase
        .from('document_upload_tokens')
        .update({ status: 'expired' })
        .eq('id', validToken.id);
      return new Response(
        JSON.stringify({ success: false, error: 'This upload link has expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { loan_application_id, org_id } = validToken;

    // Upload file to storage
    const fileExt = file.name.split('.').pop() || 'pdf';
    const storagePath = `${org_id}/${loan_application_id}/${documentType}_${Date.now()}.${fileExt}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('loan-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[public-document-upload] Storage error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to upload file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if document of this type already exists - update instead of insert
    const { data: existingDoc } = await supabase
      .from('loan_documents')
      .select('id')
      .eq('loan_application_id', loan_application_id)
      .eq('document_type', documentType)
      .maybeSingle();

    let documentId: string;

    if (existingDoc) {
      const { error: updateError } = await supabase
        .from('loan_documents')
        .update({
          file_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          upload_status: 'uploaded',
          verification_status: 'pending',
          parsing_status: 'idle',
          ocr_data: {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDoc.id);

      if (updateError) {
        console.error('[public-document-upload] Update error:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update document record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      documentId = existingDoc.id;
    } else {
      const { data: newDoc, error: insertError } = await supabase
        .from('loan_documents')
        .insert({
          loan_application_id,
          document_type: documentType,
          document_category: documentCategory,
          file_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          upload_status: 'uploaded',
          verification_status: 'pending',
        })
        .select('id')
        .single();

      if (insertError || !newDoc) {
        console.error('[public-document-upload] Insert error:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create document record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      documentId = newDoc.id;
    }

    console.log(`[public-document-upload] Uploaded ${documentType} for application ${loan_application_id}: ${storagePath}`);

    // Trigger auto-parsing (fire-and-forget)
    const NON_PARSEABLE = ['photo'];
    if (!NON_PARSEABLE.includes(documentType)) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        fetch(`${supabaseUrl}/functions/v1/parse-loan-document`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId,
            documentType,
            filePath: storagePath,
          }),
        }).catch(err => console.error('[public-document-upload] Parse trigger error:', err));

        console.log(`[public-document-upload] Triggered parsing for document ${documentId}`);
      } catch (parseErr) {
        console.error('[public-document-upload] Failed to trigger parsing:', parseErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        document_type: documentType,
        file_name: file.name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[public-document-upload] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
