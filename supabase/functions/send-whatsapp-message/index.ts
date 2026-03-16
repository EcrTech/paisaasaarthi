import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SendMessageRequest {
  contactId?: string; // Now optional - will be resolved from phone number if not provided
  phoneNumber: string;
  templateId?: string;
  templateName?: string; // For hardcoded templates like "conversation"
  templateVariables?: Record<string, string>;
  message?: string;
  // Media attachment support
  mediaType?: 'image' | 'document' | 'video' | 'audio';
  mediaUrl?: string;
  mediaCaption?: string;
}

/**
 * Resolve or create a contact ID from a phone number.
 * This handles cases where the frontend passes an invalid ID (like loan_application.id)
 */
async function resolveContactId(
  supabaseClient: any,
  phoneNumber: string,
  orgId: string,
  providedContactId?: string
): Promise<string | null> {
  // If a contact ID was provided, verify it actually exists in the contacts table
  if (providedContactId) {
    const { data: existingContact, error: lookupError } = await supabaseClient
      .from('contacts')
      .select('id')
      .eq('id', providedContactId)
      .single();
    
    if (existingContact && !lookupError) {
      console.log('✓ Provided contactId verified:', providedContactId);
      return existingContact.id;
    }
    console.log('Provided contactId not found in contacts table, will lookup by phone');
  }
  
  // Normalize phone number for lookup (ensure + prefix)
  const normalizedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber.replace(/[^\d]/g, '');
  const phoneDigitsOnly = phoneNumber.replace(/[^\d]/g, '');
  
  // Look up contact by phone number (try multiple formats)
  const { data: contactByPhone, error: phoneError } = await supabaseClient
    .from('contacts')
    .select('id')
    .eq('org_id', orgId)
    .or(`phone.eq.${normalizedPhone},phone.eq.${phoneDigitsOnly},phone.ilike.%${phoneDigitsOnly.slice(-10)}`)
    .limit(1)
    .single();
  
  if (contactByPhone && !phoneError) {
    console.log('✓ Found existing contact by phone:', contactByPhone.id);
    return contactByPhone.id;
  }
  
  console.log('No existing contact found for phone, creating new contact');
  
  // Create a new contact for this phone number
  const { data: newContact, error: createError } = await supabaseClient
    .from('contacts')
    .insert({
      phone: normalizedPhone,
      org_id: orgId,
      first_name: normalizedPhone, // Placeholder - will be updated when profile_name is received
      source: 'whatsapp'
    })
    .select('id')
    .single();
  
  if (createError) {
    console.error('Failed to create contact:', createError);
    return null;
  }
  
  console.log('✓ Created new contact:', newContact.id);
  return newContact.id;
}

/**
 * Extract message SID from Exotel V2 response
 * The response structure is: { response: { whatsapp: { messages: [{ data: { sid: "..." } }] } } }
 */
function extractMessageSid(exotelResult: any): string | null {
  // Try nested V2 response structure first
  const nestedSid = exotelResult?.response?.whatsapp?.messages?.[0]?.data?.sid;
  if (nestedSid) return nestedSid;
  
  // Try flat response structure
  if (exotelResult?.sid) return exotelResult.sid;
  if (exotelResult?.id) return exotelResult.id;
  
  // Try messages array at root level
  const rootMessageSid = exotelResult?.whatsapp?.messages?.[0]?.data?.sid;
  if (rootMessageSid) return rootMessageSid;
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== send-whatsapp-message Request Started ===');
    console.log('Request method:', req.method);
    console.log('Timestamp:', new Date().toISOString());

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Auth failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.email);

    const body: SendMessageRequest = await req.json();
    const { contactId: providedContactId, phoneNumber, templateId, templateName, templateVariables, message, mediaType, mediaUrl, mediaCaption } = body;

    console.log('Request body:', {
      providedContactId,
      phoneNumber,
      templateId: templateId || 'N/A',
      templateName: templateName || 'N/A',
      hasMessage: !!message,
      hasMedia: !!mediaUrl,
      mediaType: mediaType || 'N/A'
    });

    // Fetch user profile and org_id
    console.log('Fetching user profile and org_id...');
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    console.log('Profile Lookup Result:', {
      found: !!profile,
      orgId: profile?.org_id || 'N/A',
      hasError: !!profileError,
      errorMessage: profileError?.message || 'N/A'
    });

    if (profileError) {
      console.error('Profile Error:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!profile?.org_id) {
      throw new Error('Organization not found');
    }

    console.log('✓ Organization verified:', profile.org_id);

    // Resolve the actual contact ID from phone number
    const resolvedContactId = await resolveContactId(
      supabaseClient,
      phoneNumber,
      profile.org_id,
      providedContactId
    );

    if (!resolvedContactId) {
      console.error('Failed to resolve contact ID');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not find or create contact for this phone number' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✓ Using contact ID:', resolvedContactId);

    // Get WhatsApp settings with Exotel credentials
    const { data: whatsappSettings } = await supabaseClient
      .from('whatsapp_settings')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('is_active', true)
      .single();

    if (!whatsappSettings) {
      return new Response(JSON.stringify({ success: false, error: 'WhatsApp not configured for this organization' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate Exotel credentials
    if (!whatsappSettings.exotel_sid || !whatsappSettings.exotel_api_key || !whatsappSettings.exotel_api_token) {
      return new Response(JSON.stringify({ success: false, error: 'Exotel credentials not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let messageContent = message || '';
    let templateData = null;
    let useTemplateApi = false;

    // If using templateName (hardcoded template like "conversation"), use Exotel template API
    if (templateName) {
      useTemplateApi = true;
      // For hardcoded templates, message content is passed in the request
      messageContent = message || '';
    }
    // If using a template from database, fetch it
    else if (templateId) {
      const { data: template } = await supabaseClient
        .from('communication_templates')
        .select('*')
        .eq('id', templateId)
        .eq('org_id', profile.org_id)
        .single();

      if (!template) {
        return new Response(JSON.stringify({ success: false, error: 'Template not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      messageContent = template.content;
      
      // Replace variables in template
      if (templateVariables) {
        Object.entries(templateVariables).forEach(([key, value]) => {
          messageContent = messageContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
      }

      templateData = {
        id: template.template_id,
        params: templateVariables ? Object.values(templateVariables) : [],
      };
    }

    // Format phone number - remove non-digits for Exotel API call
    let phoneDigits = phoneNumber.replace(/[^\d]/g, '');
    
    // If phone is 10 digits (Indian local number), prepend country code 91
    if (phoneDigits.length === 10) {
      phoneDigits = '91' + phoneDigits;
    }
    
    // Store with + prefix for consistency with UI queries
    const phoneForStorage = '+' + phoneDigits;

    // Build Exotel API URL - ALWAYS use /messages endpoint for WhatsApp templates
    const exotelSubdomain = whatsappSettings.exotel_subdomain || 'api.exotel.com';
    const exotelUrl = `https://${exotelSubdomain}/v2/accounts/${whatsappSettings.exotel_sid}/messages`;
    let exotelPayload: any;

    if (useTemplateApi) {
      // Build template components with variables if provided
      const components: any[] = [];
      if (templateVariables && Object.keys(templateVariables).length > 0) {
        // Convert { "1": "value1", "2": "value2" } to body parameters array
        const sortedKeys = Object.keys(templateVariables).sort((a, b) => Number(a) - Number(b));
        const parameters = sortedKeys.map(key => ({
          type: "text",
          text: templateVariables[key],
        }));
        components.push({
          type: "body",
          parameters,
        });
      }

      exotelPayload = {
        whatsapp: {
          messages: [{
            from: whatsappSettings.whatsapp_source_number,
            to: phoneDigits,
            content: {
              type: "template",
              template: {
                name: templateName,
                language: { code: "en" },
                components,
              }
            }
          }]
        }
      };

      // Build readable message content for storage
      if (templateVariables) {
        messageContent = Object.values(templateVariables).join(' | ');
      }
    } else if (mediaUrl && mediaType) {
      // Media message (image, document, video, audio)
      // Exotel V2 API expects "link" not "url" for media content
      const mediaContent: any = {
        link: mediaUrl,
      };
      // Only add caption if provided
      if (mediaCaption) {
        mediaContent.caption = mediaCaption;
      }
      
      exotelPayload = {
        whatsapp: {
          messages: [{
            from: whatsappSettings.whatsapp_source_number,
            to: phoneDigits,
            content: {
              type: mediaType,
              [mediaType]: mediaContent
            }
          }]
        }
      };
      
      // Use caption as message content for storage, or generate placeholder
      messageContent = mediaCaption || `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}]`;
    } else {
      // Use standard messaging API for plain messages or database templates
      // FIX: Exotel V2 API requires text content as { body: "..." } not just a string
      exotelPayload = {
        whatsapp: {
          messages: [{
            from: whatsappSettings.whatsapp_source_number,
            to: phoneDigits,
            content: {
              type: "text",
              text: { body: messageContent } // FIXED: nested body object
            }
          }]
        }
      };
    }

    console.log('Sending WhatsApp message via Exotel:', { 
      url: exotelUrl,
      to: phoneDigits, 
      useTemplateApi, 
      templateName: templateName || 'N/A',
      bodyLength: messageContent?.length || 0,
      payload: JSON.stringify(exotelPayload)
    });

    // Send via Exotel API
    const exotelResponse = await fetch(exotelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${whatsappSettings.exotel_api_key}:${whatsappSettings.exotel_api_token}`)}`,
      },
      body: JSON.stringify(exotelPayload),
    });

    // Read response as text first, then try to parse as JSON
    const responseText = await exotelResponse.text();
    console.log('Exotel raw response:', responseText);
    
    let exotelResult: any;
    try {
      exotelResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Exotel response as JSON:', parseError);
      // Try to extract JSON from the response if it's mixed content
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          exotelResult = JSON.parse(jsonMatch[0]);
        } catch {
          exotelResult = { raw: responseText, error: 'Invalid JSON response' };
        }
      } else {
        exotelResult = { raw: responseText, error: 'Non-JSON response' };
      }
    }
    console.log('Exotel parsed response:', exotelResult);

    // Extract message SID from response
    const exotelSid = extractMessageSid(exotelResult);
    console.log('Extracted Exotel SID:', exotelSid || 'NOT FOUND');

    // Check for empty or error response
    if (!exotelResponse.ok || !exotelSid) {
      const errorMessage = exotelResult?.message || exotelResult?.error || 'Exotel API failed - no message ID returned';
      console.error('Exotel API Error:', errorMessage);
      
      // Log failed message
      await supabaseClient.from('whatsapp_messages').insert({
        org_id: profile.org_id,
        contact_id: resolvedContactId,
        template_id: templateId || null,
        sent_by: user.id,
        phone_number: phoneForStorage,
        message_content: messageContent,
        template_variables: templateVariables || null,
        status: 'failed',
        direction: 'outbound',
        error_message: errorMessage,
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          exotelResponse: exotelResult 
        }),
        {
          status: exotelResponse.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log successful message
    const { data: messageRecord, error: insertError } = await supabaseClient
      .from('whatsapp_messages')
      .insert({
        org_id: profile.org_id,
        contact_id: resolvedContactId,
        template_id: templateId || null,
        sent_by: user.id,
        phone_number: phoneForStorage,
        message_content: messageContent,
        template_variables: templateVariables || null,
        exotel_message_id: exotelSid,
        status: 'sent',
        direction: 'outbound',
        sent_at: new Date().toISOString(),
        media_url: mediaUrl || null,
        media_type: mediaType || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert message record:', insertError);
      // Return partial success - message was sent but not stored
      return new Response(
        JSON.stringify({
          success: true,
          partial: true,
          messageId: exotelSid,
          warning: 'Message sent but failed to store in database',
          dbError: insertError.message
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✓ Message record inserted:', messageRecord.id);

    // Use shared service role client for wallet deduction
    const supabaseServiceClient = getSupabaseClient();

    // Deduct WhatsApp cost from wallet
    const { data: deductResult, error: deductError } = await supabaseServiceClient.rpc('deduct_from_wallet', {
      _org_id: profile.org_id,
      _amount: 1.00,
      _service_type: 'whatsapp',
      _reference_id: messageRecord.id,
      _quantity: 1,
      _unit_cost: 1.00,
      _user_id: user.id
    });

    if (deductError || !deductResult?.success) {
      console.warn('Wallet deduction failed:', deductError || deductResult);
    }

    // Log activity (use resolved contact ID)
    await supabaseClient.from('contact_activities').insert({
      org_id: profile.org_id,
      contact_id: resolvedContactId,
      activity_type: 'whatsapp',
      subject: 'WhatsApp Message Sent',
      description: messageContent,
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: exotelSid,
        message: messageRecord,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const err = error as Error;
    console.error('=== send-whatsapp-message Error ===');
    console.error('Error Type:', err.constructor.name);
    console.error('Error Message:', err.message);
    console.error('Error Stack:', err.stack);
    console.error('Timestamp:', new Date().toISOString());
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        status: err.message?.includes('Unauthorized') || err.message?.includes('Authentication') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
