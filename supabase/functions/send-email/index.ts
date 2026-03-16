import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const sendEmail = async (to: string, subject: string, html: string, fromEmail: string, fromName: string, replyToEmail?: string, unsubscribeUrl?: string) => {
  const emailPayload: any = {
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject: subject,
    html: html,
  };
  
  // Add reply_to if provided and different from sender
  if (replyToEmail && replyToEmail !== fromEmail) {
    emailPayload.reply_to = [replyToEmail];
  }

  // Add List-Unsubscribe headers for RFC 8058 compliance
  if (unsubscribeUrl) {
    emailPayload.headers = {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send email");
  }

  return response.json();
};

interface SendEmailRequest {
  to: string;
  subject: string;
  htmlContent?: string;
  html?: string;
  contactId?: string;
  conversationId?: string;
  trackingPixelId?: string;
  unsubscribeToken?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== send-email Request Started ===');
    console.log('Request method:', req.method);
    console.log('Timestamp:', new Date().toISOString());

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth failed:', authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('User authenticated:', user.email);

    const { 
      to, 
      subject, 
      htmlContent, 
      html, 
      contactId, 
      conversationId,
      trackingPixelId,
      unsubscribeToken 
    }: SendEmailRequest = await req.json();

    const emailHtml = htmlContent || html || '';

    if (!emailHtml) {
      throw new Error('Email content is required');
    }

    // Fetch user profile and org_id
    console.log('Fetching user profile and org_id...');
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("org_id, first_name, last_name")
      .eq("id", user.id)
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
      throw new Error("User organization not found");
    }

    console.log('✓ Organization verified:', profile.org_id);

    // Get email settings and verify domain - with fallback for orgs without custom domain
    const { data: emailSettings, error: settingsError } = await supabaseClient
      .from("email_settings")
      .select("sending_domain, verification_status, is_active, resend_domain_id")
      .eq("org_id", profile.org_id)
      .maybeSingle();

    let sendingDomain: string;
    let skipDomainVerification = false;

    if (emailSettings?.is_active && emailSettings.verification_status === 'verified') {
      // Use organization's verified domain
      sendingDomain = emailSettings.sending_domain;
      
      // Double-check domain status with Resend API to avoid stale data issues
      console.log('Checking domain status with Resend API...');
      const domainCheckResponse = await fetch(
        `https://api.resend.com/domains/${emailSettings.resend_domain_id}`,
        {
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
        }
      );

      if (domainCheckResponse.ok) {
        const domainStatus = await domainCheckResponse.json();
        console.log('Current Resend domain status:', domainStatus.status);
        
        if (domainStatus.status !== 'verified') {
          // Update database with actual status
          await supabaseClient
            .from('email_settings')
            .update({ verification_status: 'pending' })
            .eq('org_id', profile.org_id);
          
          // Fall back to default domain instead of failing
          console.log('Domain verification incomplete, falling back to default domain');
          sendingDomain = 'paisaasaarthi.com';
          skipDomainVerification = true;
        }
      }
    } else {
      // Fallback: Use verified platform domain (same pattern as E-Sign notifications)
      console.log('No custom email settings found, using platform default domain: paisaasaarthi.com');
      sendingDomain = 'paisaasaarthi.com';
      skipDomainVerification = true;
    }

    // Use verified domain as sender, user's email as reply-to
    const fromEmail = `info@${sendingDomain}`;
    const replyToEmail = user.email || fromEmail;
    const fromName = "Paisaa Saarthi";

    console.log("Sending email to:", to, "from:", fromEmail, "reply-to:", replyToEmail);

    // Generate unsubscribe token if not provided
    const unsubToken = unsubscribeToken || crypto.randomUUID();
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${unsubToken}`;

    // Inject unsubscribe footer into email HTML
    const unsubscribeFooter = `
      <div style="margin: 40px 0 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
          You're receiving this email because you interacted with our platform.<br>
          <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> from these emails
        </p>
      </div>
    `;
    const finalHtml = emailHtml.includes('</body>') 
      ? emailHtml.replace('</body>', `${unsubscribeFooter}</body>`)
      : emailHtml + unsubscribeFooter;

    // Send email via Resend
    const emailData = await sendEmail(to, subject, finalHtml, fromEmail, fromName, replyToEmail, unsubscribeUrl);

    console.log("Email sent successfully:", emailData);

    // Use shared service role client for wallet deduction
    const supabaseServiceClient = getSupabaseClient();

    // Deduct email cost from wallet
    const { data: deductResult, error: deductError } = await supabaseServiceClient.rpc('deduct_from_wallet', {
      _org_id: profile.org_id,
      _amount: 0.10, // Get from pricing
      _service_type: 'email',
      _reference_id: null, // Will be updated after logging
      _quantity: 1,
      _unit_cost: 0.10,
      _user_id: user.id
    });

    if (deductError || !deductResult?.success) {
      console.warn('Wallet deduction failed:', deductError || deductResult);
      // Email was sent, but wallet deduction failed - log but don't fail the request
    }

    // Log email to email_conversations table
    console.log('[send-email] Logging email to database...');
    
    // Build insert object - only include contact_id if provided and valid
    const emailLogData: Record<string, any> = {
      org_id: profile.org_id,
      conversation_id: conversationId || emailData?.id || crypto.randomUUID(),
      from_email: fromEmail,
      from_name: fromName,
      to_email: to,
      reply_to_email: replyToEmail,
      subject: subject,
      email_content: emailHtml,
      html_content: emailHtml,
      direction: "outbound",
      sent_by: user.id,
      status: "sent",
      sent_at: new Date().toISOString(),
      tracking_pixel_id: trackingPixelId,
      unsubscribe_token: unsubToken,
    };
    
    // Only add contact_id if provided - it may be an applicant ID not a contact ID
    if (contactId) {
      // Verify contactId exists in contacts table before adding
      const { data: contactExists } = await supabaseClient
        .from('contacts')
        .select('id')
        .eq('id', contactId)
        .maybeSingle();
      
      if (contactExists) {
        emailLogData.contact_id = contactId;
      } else {
        console.log('[send-email] contact_id not found in contacts table, skipping foreign key');
      }
    }
    
    const { error: logError } = await supabaseClient
      .from("email_conversations")
      .insert(emailLogData);

    if (logError) {
      console.error('[send-email] Error logging email to email_conversations:', logError);
      console.error('[send-email] Email was sent but database logging failed');
      // Don't throw - email was sent successfully
    } else {
      console.log('[send-email] Email logged successfully to database');
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailData?.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error('=== send-email Error ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Timestamp:', new Date().toISOString());
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: error.message.includes('Unauthorized') || error.message.includes('Authentication') ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
