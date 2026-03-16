import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface WebhookPayload {
  [key: string]: any;
}

interface FormWithConfig {
  id: string;
  name: string;
  org_id: string;
  connector_type: string;
  webhook_token: string;
  webhook_config: {
    http_method?: 'GET' | 'POST';
    target_table?: 'contacts';
    source_name?: string;
    field_mappings?: Record<string, string>;
  };
  rate_limit_per_minute: number;
  form_fields: Array<{
    custom_field_id: string;
    custom_fields: {
      id: string;
      field_name: string;
      field_label: string;
      field_type: string;
      is_required: boolean;
    };
  }>;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('=== WEBHOOK REQUEST START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight - returning 200');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract webhook token from URL path
    const url = new URL(req.url);
    const webhookToken = url.pathname.split('/').pop();
    console.log('Extracted webhook token:', webhookToken);

    if (!webhookToken) {
      console.error('ERROR: Missing webhook token in URL');
      return errorResponse(400, 'Missing webhook token in URL');
    }

    // Create Supabase admin client
    const supabase = getSupabaseClient();

    const requestId = `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const clientIp = forwardedFor.split(',')[0].trim();
    
    // Parse request payload (GET or POST)
    let payload: WebhookPayload;
    if (req.method === 'GET') {
      // Extract from query parameters
      payload = {};
      url.searchParams.forEach((value, key) => {
        payload[key] = value;
      });
      console.log('GET request - parsed query params:', payload);
    } else {
      // Parse JSON body for POST
      try {
        const rawBody = await req.text();
        console.log('POST request - raw body:', rawBody);
        payload = JSON.parse(rawBody);
        console.log('Parsed payload:', payload);
      } catch (e) {
        console.error('ERROR: Failed to parse JSON:', e);
        return errorResponse(400, 'Invalid JSON payload', requestId);
      }
    }

    // Step 1: Get form/connector by webhook token
    console.log('STEP 1: Fetching form by webhook token...');
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select(`
        *,
        form_fields (
          custom_field_id,
          custom_fields (
            id,
            field_name,
            field_label,
            field_type,
            is_required
          )
        )
      `)
      .eq('webhook_token', webhookToken)
      .eq('is_active', true)
      .single();

    if (formError || !form) {
      console.error('ERROR: Form not found or query error:', formError);
      await logWebhook(supabase, null, null, requestId, 'error', 404, payload, 'Webhook endpoint not found', clientIp);
      return errorResponse(404, 'Webhook endpoint not found', requestId);
    }

    console.log('Form found:', { id: form.id, name: form.name, org_id: form.org_id });
    const typedForm = form as unknown as FormWithConfig;

    // Validate HTTP method
    const expectedMethod = typedForm.webhook_config?.http_method || 'POST';
    if (req.method !== expectedMethod) {
      console.error(`ERROR: Wrong HTTP method. Expected ${expectedMethod}, got ${req.method}`);
      await logWebhook(supabase, typedForm.id, typedForm.org_id, requestId, 'error', 405, payload, `Method not allowed. Expected ${expectedMethod}`, clientIp);
      return errorResponse(405, `Method not allowed. This webhook expects ${expectedMethod} requests`, requestId);
    }

    // Step 2: Check rate limit
    console.log('STEP 2: Checking rate limit...');
    const { data: rateLimitOk, error: rateLimitError } = await supabase
      .rpc('check_connector_rate_limit', {
        _form_id: typedForm.id,
        _limit: typedForm.rate_limit_per_minute || 60
      });

    if (!rateLimitOk) {
      console.warn('WARN: Rate limit exceeded');
      await logWebhook(supabase, typedForm.id, typedForm.org_id, requestId, 'error', 429, payload, 'Rate limit exceeded', clientIp);
      return errorResponse(429, 'Rate limit exceeded. Maximum ' + (typedForm.rate_limit_per_minute || 60) + ' requests per minute', requestId);
    }

    // Step 3: Route to appropriate handler based on target table
    const targetTable = typedForm.webhook_config?.target_table || 'contacts';
    console.log('STEP 3: Routing to handler for table:', targetTable);

    let responseData: any;
    
    if (targetTable === 'contacts') {
      responseData = await handleContactInsertion(supabase, typedForm, payload, requestId, clientIp);
    } else {
      throw new Error('Unknown target table: ' + targetTable);
    }

    const elapsedTime = Date.now() - startTime;
    console.log('=== WEBHOOK REQUEST SUCCESS ===');
    console.log('Request ID:', requestId);
    console.log('Target table:', targetTable);
    console.log('Elapsed time:', elapsedTime, 'ms');

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    console.error('=== WEBHOOK REQUEST ERROR ===');
    console.error('Error:', error);
    console.error('Elapsed time:', elapsedTime, 'ms');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, 'Internal server error: ' + errorMessage);
  }
});

// Handler for Contacts table
async function handleContactInsertion(
  supabase: any,
  form: FormWithConfig,
  payload: WebhookPayload,
  requestId: string,
  clientIp: string
) {
  console.log('Handling contact insertion...');
  
  const mappedContact = mapContactFields(payload, form.webhook_config?.field_mappings || {});
  console.log('Mapped contact:', mappedContact);

  const errors = validateContact(mappedContact);
  if (errors.length > 0) {
    console.error('Validation failed:', errors);
    await logWebhook(supabase, form.id, form.org_id, requestId, 'error', 400, payload, `Validation failed: ${errors.join(', ')}`, clientIp);
    throw new Error('Validation failed: ' + errors.join(', '));
  }

  // Check for duplicate by phone (flexible match: 10-digit, +91, 91 prefix variants)
  const webhookPhone10 = (mappedContact.phone || '').replace(/\D/g, '').slice(-10);
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email')
    .eq('org_id', form.org_id)
    .or(`phone.eq.${webhookPhone10},phone.eq.+91${webhookPhone10},phone.eq.91${webhookPhone10}`)
    .limit(1)
    .maybeSingle();

  let contactId: string;
  let isDuplicate = false;

  if (existingContact) {
    isDuplicate = true;
    contactId = existingContact.id;
    
    await supabase
      .from('contacts')
      .update({
        first_name: mappedContact.first_name,
        last_name: mappedContact.last_name || null,
        email: mappedContact.email,
        company: mappedContact.company || null,
        notes: mappedContact.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId);

    const responseData = {
      success: true,
      message: 'Contact updated (duplicate phone number)',
      contact_id: contactId,
      status: 'duplicate',
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    await logWebhook(supabase, form.id, form.org_id, requestId, 'duplicate', 200, payload, null, clientIp, contactId, responseData);
    return responseData;
  }

  // Get default pipeline stage
  const { data: defaultStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('org_id', form.org_id)
    .eq('name', 'New')
    .eq('is_active', true)
    .maybeSingle();

  // Create new contact
  const { data: newContact, error: insertError } = await supabase
    .from('contacts')
    .insert({
      org_id: form.org_id,
      first_name: mappedContact.first_name,
      last_name: mappedContact.last_name || null,
      email: mappedContact.email,
      phone: mappedContact.phone,
      company: mappedContact.company || null,
      notes: mappedContact.notes || null,
      source: form.webhook_config?.source_name || form.name,
      status: 'new',
      pipeline_stage_id: defaultStage?.id || null
    })
    .select()
    .single();

  if (insertError) throw insertError;
  contactId = newContact.id;

  // Log activity
  await supabase
    .from('contact_activities')
    .insert({
      contact_id: contactId,
      org_id: form.org_id,
      activity_type: 'note',
      subject: `Webhook Lead: ${form.name}`,
      description: `Lead received from ${form.webhook_config?.source_name || form.name} via webhook`,
      completed_at: new Date().toISOString()
    });

  const responseData = {
    success: true,
    message: 'Contact created successfully',
    contact_id: contactId,
    status: 'created',
    request_id: requestId,
    timestamp: new Date().toISOString()
  };

  await logWebhook(supabase, form.id, form.org_id, requestId, 'success', 200, payload, null, clientIp, contactId, responseData);
  return responseData;
}

// Field mapping functions
function mapContactFields(payload: WebhookPayload, fieldMappings: Record<string, string>): any {
  const mapped: any = {};

  for (const [incomingField, targetField] of Object.entries(fieldMappings)) {
    const value = payload[incomingField];
    if (value !== undefined && value !== null) {
      mapped[targetField] = String(value).trim();
    }
  }

  // Default mappings
  if (!mapped.first_name && payload.name) {
    const nameParts = String(payload.name).trim().split(' ');
    mapped.first_name = nameParts[0];
    mapped.last_name = nameParts.slice(1).join(' ') || null;
  }
  if (!mapped.first_name && payload.first_name) mapped.first_name = String(payload.first_name).trim();
  if (!mapped.last_name && payload.last_name) mapped.last_name = String(payload.last_name).trim();
  if (!mapped.email && payload.email) mapped.email = String(payload.email).trim().toLowerCase();
  if (!mapped.phone && payload.phone) mapped.phone = String(payload.phone).trim();
  if (!mapped.phone && payload.mobile) mapped.phone = String(payload.mobile).trim();
  if (!mapped.company && payload.company) mapped.company = String(payload.company).trim();
  if (!mapped.company && payload.company_name) mapped.company = String(payload.company_name).trim();

  return mapped;
}

// Validation functions
function validateContact(contact: any): string[] {
  const errors: string[] = [];
  
  if (!contact.first_name || contact.first_name.trim() === '') {
    errors.push('name/first_name is required');
  }
  if (!contact.email || contact.email.trim() === '') {
    errors.push('email is required');
  }
  if (!contact.phone || contact.phone.trim() === '') {
    errors.push('phone is required');
  }
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.push('invalid email format');
  }
  if (contact.phone) {
    const digits = contact.phone.replace(/\D/g, '');
    if (digits.length < 10) {
      errors.push('phone number must have at least 10 digits');
    }
  }

  return errors;
}

// Logging helper
async function logWebhook(
  supabase: any,
  formId: string | null,
  orgId: string | null,
  requestId: string,
  status: string,
  httpCode: number,
  request: any,
  errorMsg: string | null = null,
  ipAddress: string = 'unknown',
  contactId: string | null = null,
  response: any = null
) {
  if (!formId || !orgId) return;

  try {
    await supabase.from('connector_logs').insert({
      form_id: formId,
      org_id: orgId,
      request_id: requestId,
      status,
      http_status_code: httpCode,
      request_payload: request,
      response_payload: response || {},
      error_message: errorMsg,
      contact_id: contactId,
      ip_address: ipAddress
    });
  } catch (e) {
    console.error('Failed to log webhook:', e);
  }
}

function errorResponse(status: number, message: string, requestId?: string, errors?: string[]) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      errors: errors,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
