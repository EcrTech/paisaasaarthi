import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

// In-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 3;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return true;
  }
  
  if (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return true;
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Normalize phone to last 10 digits for consistent dedup across channels
function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

function validatePAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan?.toUpperCase() || '');
}

function validateAadhaar(aadhaar: string): boolean {
  return /^[0-9]{12}$/.test(aadhaar?.replace(/\s/g, '') || '');
}

function validatePhone(phone: string): boolean {
  return /^[6-9][0-9]{9}$/.test(phone?.replace(/\s/g, '') || '');
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

// Flexible phone lookup filter: matches 10-digit, +91, and 91 prefix variants
function phoneMatchFilter(phone10: string): string {
  return `phone.eq.${phone10},phone.eq.+91${phone10},phone.eq.91${phone10}`;
}

async function generateApplicationNumber(supabase: any): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Use database sequence for guaranteed uniqueness
  const { data, error } = await supabase.rpc('nextval_text', { seq_name: 'loan_application_number_seq' }).maybeSingle();
  
  if (error || !data) {
    // Fallback: use timestamp + random for uniqueness
    const ts = Date.now().toString(36);
    const random = String(Math.floor(Math.random() * 999)).padStart(3, '0');
    return `LA-${year}${month}-${ts}${random}`;
  }
  
  const seqNum = String(data).padStart(5, '0');
  return `LA-${year}${month}-${seqNum}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    console.log(`[submit-loan-application] Request from IP: ${clientIP}`);

    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      console.log(`[submit-loan-application] Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again in a few minutes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log(`[submit-loan-application] Processing application`, { 
      formSlug: body.formSlug, 
      referralCode: body.referralCode,
      hasApplicant: !!body.applicant 
    });

    // Detect if this is a referral application (simpler format)
    const isReferralApplication = !!body.applicant && !!body.referralCode;

    // Bot detection - check honeypot field
    if (body.honeypot) {
      console.log('[submit-loan-application] Bot detected via honeypot');
      return new Response(
        JSON.stringify({ error: 'Invalid submission' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bot detection - check form fill time (minimum 5 seconds) - skip for referral apps
    const formStartTime = body.formStartTime;
    if (formStartTime && Date.now() - formStartTime < 5000) {
      console.log('[submit-loan-application] Bot detected via timing');
      return new Response(
        JSON.stringify({ error: 'Please take your time filling the form' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle referral-based submissions
    let formConfig: any = null;
    let referrerUserId: string | null = null;

    if (body.referralCode) {
      // Lookup referral code
      const { data: referralData, error: refError } = await supabase
        .from('user_referral_codes')
        .select('user_id, org_id')
        .eq('referral_code', body.referralCode)
        .eq('is_active', true)
        .single();

      if (refError || !referralData) {
        console.log(`[submit-loan-application] Invalid referral code: ${body.referralCode}`);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired referral code' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      referrerUserId = referralData.user_id;
      formConfig = { org_id: referralData.org_id, product_type: 'personal_loan' };
      console.log(`[submit-loan-application] Referral submission from user: ${referrerUserId}`);
    } else {
      // Validate form slug and get form config
      const { data: formData, error: formError } = await supabase
        .from('loan_application_forms')
        .select('*')
        .eq('slug', body.formSlug)
        .eq('is_active', true)
        .single();

      if (formError || !formData) {
        console.log(`[submit-loan-application] Form not found: ${body.formSlug}`);
        return new Response(
          JSON.stringify({ error: 'Application form not found or inactive' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      formConfig = formData;
    }

    // Handle referral application (simple form) vs full public form
    if (isReferralApplication) {
      // 24-hour phone rate limit: only one referral application per phone per day
      const rateLimitPhone = normalizePhone(body.applicant?.phone || '');
      if (rateLimitPhone) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existingContactForRateLimit } = await supabase
          .from('contacts')
          .select('id')
          .eq('org_id', formConfig.org_id)
          .or(phoneMatchFilter(rateLimitPhone))
          .limit(1)
          .maybeSingle();

        if (existingContactForRateLimit) {
          const { data: recentAppFromPhone } = await supabase
            .from('loan_applications')
            .select('id')
            .eq('contact_id', existingContactForRateLimit.id)
            .neq('status', 'draft')
            .neq('status', 'rejected')
            .gte('created_at', twentyFourHoursAgo)
            .limit(1)
            .maybeSingle();

          if (recentAppFromPhone) {
            console.log(`[submit-loan-application] 24h phone limit: ${rateLimitPhone.slice(-4)} already has a recent application`);
            return new Response(
              JSON.stringify({ error: 'An application has already been submitted with this phone number in the last 24 hours. Please try again later.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // Simpler validation for referral applications
      const applicant = body.applicant;
      const errors: string[] = [];

      if (!applicant?.name?.trim()) {
        errors.push('Full name is required');
      }
      if (!validatePhone(applicant?.phone)) {
        errors.push('Invalid mobile number format');
      }
      // PAN and Aadhaar are optional for referral applications
      if (applicant?.pan && !validatePAN(applicant.pan)) {
        errors.push('Invalid PAN number format');
      }
      if (applicant?.aadhaar && !validateAadhaar(applicant.aadhaar)) {
        errors.push('Invalid Aadhaar number format');
      }
      if (applicant?.email && !validateEmail(applicant.email)) {
        errors.push('Invalid email format');
      }

      // Geolocation is mandatory for referral applications
      if (!body.geolocation?.latitude || !body.geolocation?.longitude) {
        errors.push('Location access is required. Please enable location permissions and try again.');
      }

      if (errors.length > 0) {
        console.log(`[submit-loan-application] Referral validation errors:`, errors);
        return new Response(
          JSON.stringify({ error: 'Validation failed', details: errors }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Process referral application
      // Parse name into first/last
      const nameParts = applicant.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Check if we have a draft application to update (preserves Video KYC link)
      let draftApplicationId = body.draftApplicationId;
      let application: any;
      let applicationNumber: string = '';

      // If no draftApplicationId provided, look for existing draft by phone number to prevent duplicates
      const normalizedPhone = normalizePhone(applicant.phone);
      if (!draftApplicationId && normalizedPhone) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('org_id', formConfig.org_id)
          .or(phoneMatchFilter(normalizedPhone))
          .limit(1)
          .maybeSingle();

        if (existingContact) {
          const { data: existingDraftByContact } = await supabase
            .from('loan_applications')
            .select('id')
            .eq('contact_id', existingContact.id)
            .eq('status', 'draft')
            .eq('org_id', formConfig.org_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingDraftByContact) {
            draftApplicationId = existingDraftByContact.id;
            console.log(`[submit-loan-application] Found existing draft by phone lookup: ${draftApplicationId}`);
          }
        }
      }

      if (draftApplicationId) {
        console.log(`[submit-loan-application] Checking for existing draft: ${draftApplicationId}`);

        const { data: existingDraft, error: draftError } = await supabase
          .from('loan_applications')
          .select('*')
          .eq('id', draftApplicationId)
          .eq('status', 'draft')
          .single();

        if (!draftError && existingDraft) {
          // Update the existing draft instead of creating new application
          applicationNumber = await generateApplicationNumber(supabase);
          console.log(`[submit-loan-application] Updating draft ${draftApplicationId} to application: ${applicationNumber}`);

          const { data: updatedApp, error: updateError } = await supabase
            .from('loan_applications')
            .update({
              application_number: applicationNumber,
              product_type: formConfig.product_type || 'personal_loan',
              requested_amount: applicant.requestedAmount || 25000,
              tenure_months: Math.ceil((applicant.tenureDays || 30) / 30),
              tenure_days: applicant.tenureDays || 30,
              current_stage: 'application',
              status: 'in_progress',
              source: body.source || 'referral_link',
              referred_by: referrerUserId,
              submitted_from_ip: clientIP,
              latitude: body.geolocation?.latitude || null,
              longitude: body.geolocation?.longitude || null,
              geolocation_accuracy: body.geolocation?.accuracy || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', draftApplicationId)
            .select()
            .single();

          if (updateError) {
            console.error('[submit-loan-application] Error updating draft application:', updateError);
            throw updateError;
          }

          application = updatedApp;
          console.log(`[submit-loan-application] Draft converted to application: ${application.id}`);

          // Update the existing applicant record attached to this draft
          const { error: applicantUpdateError } = await supabase
            .from('loan_applicants')
            .update({
              first_name: firstName,
              last_name: lastName,
              pan_number: applicant.pan?.toUpperCase() || null,
              aadhaar_number: applicant.aadhaar?.replace(/\s/g, '') || null,
              mobile: applicant.phone,
              email: applicant.email || null,
              office_email: applicant.officeEmail || null,
              office_email_verified: applicant.officeEmailVerified || false,
              updated_at: new Date().toISOString(),
            })
            .eq('loan_application_id', draftApplicationId);

          if (applicantUpdateError) {
            console.error('[submit-loan-application] Error updating draft applicant:', applicantUpdateError);
          }
        }
      }

      // Create new application if no draft was found/updated
      if (!application) {
        // Check if an in_progress application already exists for this phone to prevent duplicates
        const { data: existingContactForDedup } = await supabase
          .from('contacts')
          .select('id')
          .eq('org_id', formConfig.org_id)
          .or(phoneMatchFilter(normalizedPhone))
          .limit(1)
          .maybeSingle();

        if (existingContactForDedup) {
          const { data: existingApp } = await supabase
            .from('loan_applications')
            .select('id, application_number')
            .eq('contact_id', existingContactForDedup.id)
            .eq('org_id', formConfig.org_id)
            .neq('status', 'rejected')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingApp) {
            console.log(`[submit-loan-application] Application already exists for this contact: ${existingApp.application_number}`);
            return new Response(
              JSON.stringify({
                success: true,
                applicationNumber: existingApp.application_number,
                applicationId: existingApp.id,
                message: 'Application already exists for this applicant'
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        applicationNumber = await generateApplicationNumber(supabase);
        console.log(`[submit-loan-application] Creating new referral application: ${applicationNumber}`);

        const { data: newApp, error: appError } = await supabase
          .from('loan_applications')
          .insert({
            org_id: formConfig.org_id,
            application_number: applicationNumber,
            product_type: formConfig.product_type || 'personal_loan',
            requested_amount: applicant.requestedAmount || 25000,
            tenure_months: Math.ceil((applicant.tenureDays || 30) / 30),
            tenure_days: applicant.tenureDays || 30,
            current_stage: 'application',
            status: 'in_progress',
            source: body.source || 'referral_link',
            referred_by: referrerUserId,
            submitted_from_ip: clientIP,
            latitude: body.geolocation?.latitude || null,
            longitude: body.geolocation?.longitude || null,
            geolocation_accuracy: body.geolocation?.accuracy || null,
          })
          .select()
          .single();

        if (appError) {
          console.error('[submit-loan-application] Error creating referral application:', appError);
          throw appError;
        }
        application = newApp;
      }

      // Assign using round-robin
      try {
        const { data: assigneeId } = await supabase.rpc('get_next_assignee', {
          p_org_id: formConfig.org_id
        });
        
        if (assigneeId) {
          await supabase
            .from('loan_applications')
            .update({ assigned_to: assigneeId })
            .eq('id', application.id);
          console.log(`[submit-loan-application] Assigned referral application to user: ${assigneeId}`);
        }
      } catch (assignError) {
        console.log('[submit-loan-application] Round-robin assignment skipped (no assignable users configured)');
      }

      console.log(`[submit-loan-application] Created referral application: ${application.id}`);

      // Check if we already have a contact from early lead creation
      const earlyLeadContactId = body.earlyLeadContactId;
      let contactId = earlyLeadContactId || null;

      if (!contactId) {
        // Check for existing contact by phone (flexible match across formats)
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('org_id', formConfig.org_id)
          .or(phoneMatchFilter(normalizedPhone))
          .limit(1)
          .maybeSingle();

        contactId = existingContact?.id;

        if (!existingContact) {
          // Create new contact/lead
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              org_id: formConfig.org_id,
              first_name: firstName,
              last_name: lastName || null,
              phone: applicant.phone,
              email: applicant.email || null,
              source: body.source || 'referral_link',
              status: 'in_progress',
              referred_by: referrerUserId || null,
              notes: `New Lead from Referral Application ${applicationNumber}`,
            })
            .select()
            .single();

          if (contactError) {
            console.error('[submit-loan-application] Error creating contact:', contactError);
          } else {
            contactId = newContact.id;
            console.log(`[submit-loan-application] Created new lead: ${newContact.id}`);
          }
        } else {
          console.log(`[submit-loan-application] Contact already exists: ${existingContact.id}`);
        }
      } else {
        // Update the early lead contact with latest info and status
        console.log(`[submit-loan-application] Updating early lead contact: ${contactId}`);
        await supabase
          .from('contacts')
          .update({
            first_name: firstName,
            last_name: lastName || null,
            email: applicant.email || null,
            status: 'in_progress',
            notes: `Application submitted: ${applicationNumber}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
      }

      // Update application with contact_id
      if (contactId) {
        await supabase
          .from('loan_applications')
          .update({ contact_id: contactId })
          .eq('id', application.id);
      }

      // Helper function to check if DOB is a valid date (not placeholder)
      const isValidDob = (dob: string | undefined) => {
        return dob && dob !== 'DOB verified' && /^\d{4}-\d{2}-\d{2}$/.test(dob);
      };

      // Extract DOB - prioritize Aadhaar DOB, then PAN DOB, then default
      let dob = '1990-01-01';
      if (isValidDob(applicant.aadhaarDob)) {
        dob = applicant.aadhaarDob;
      } else if (isValidDob(applicant.panDob)) {
        dob = applicant.panDob;
      }

      // Extract gender from Aadhaar data
      const gender = applicant.aadhaarGender || null;

      // Build current_address JSONB from structured Aadhaar address data
      let currentAddress = null;
      if (applicant.addressData) {
        currentAddress = {
          line1: applicant.addressData.line1 || '',
          line2: applicant.addressData.line2 || '',
          city: applicant.addressData.city || '',
          state: applicant.addressData.state || '',
          pincode: applicant.addressData.pincode || '',
        };
      }

      console.log('[submit-loan-application] Extracted data - DOB:', dob, 'Gender:', gender, 'Has Address:', !!currentAddress);

      // Create applicant record (upsert to handle cases where early lead already created the app but no applicant)
      const { error: applicantError } = await supabase
        .from('loan_applicants')
        .upsert({
          loan_application_id: application.id,
          applicant_type: 'primary',
          first_name: firstName,
          last_name: lastName,
          pan_number: applicant.pan?.toUpperCase() || null,
          aadhaar_number: applicant.aadhaar?.replace(/\s/g, '') || null,
          mobile: applicant.phone,
          email: applicant.email || null,
          office_email: applicant.officeEmail || null,
          office_email_verified: applicant.officeEmailVerified || false,
          dob: dob,
          gender: gender,
          current_address: currentAddress,
        }, { onConflict: 'loan_application_id,applicant_type', ignoreDuplicates: false });

      if (applicantError) {
        // Fallback to plain insert if upsert fails (e.g., no unique constraint)
        console.warn('[submit-loan-application] Upsert failed, trying insert:', applicantError.message);
        const { error: insertError } = await supabase
          .from('loan_applicants')
          .insert({
            loan_application_id: application.id,
            applicant_type: 'primary',
            first_name: firstName,
            last_name: lastName,
            pan_number: applicant.pan?.toUpperCase() || null,
            aadhaar_number: applicant.aadhaar?.replace(/\s/g, '') || null,
            mobile: applicant.phone,
            email: applicant.email || null,
            office_email: applicant.officeEmail || null,
            office_email_verified: applicant.officeEmailVerified || false,
            dob: dob,
            gender: gender,
            current_address: currentAddress,
          });
        if (insertError) {
          console.error('[submit-loan-application] Referral applicant creation error:', insertError);
        }
      }

      // Update referral stats
      if (body.referralCode) {
        const { error: refUpdateError } = await supabase.rpc('increment_referral_count', { 
          ref_code: body.referralCode 
        });
        
        if (refUpdateError) {
          // Try alternative update method
          await supabase
            .from('user_referral_codes')
            .update({ updated_at: new Date().toISOString() })
            .eq('referral_code', body.referralCode);
        }
      }

      console.log(`[submit-loan-application] Referral application completed: ${applicationNumber}`);

      // Send WhatsApp application confirmation (non-blocking)
      try {
        console.log(`[submit-loan-application] Sending WhatsApp confirmation for referral application`);
        await fetch(`${supabaseUrl}/functions/v1/send-application-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: formConfig.org_id,
            applicant_name: body.applicant.name,
            applicant_phone: body.applicant.phone,
            application_number: applicationNumber
          })
        });
      } catch (notifyError) {
        console.log('[submit-loan-application] WhatsApp confirmation skipped:', notifyError);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          applicationNumber,
          applicationId: application.id,
          message: 'Referral application submitted successfully'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Full public form validation (existing logic)
    const errors: string[] = [];

    // Personal details validation
    if (!body.personalDetails?.fullName?.trim()) {
      errors.push('Full name is required');
    }
    if (!validatePAN(body.personalDetails?.panNumber)) {
      errors.push('Invalid PAN number format');
    }
    if (!validateAadhaar(body.personalDetails?.aadhaarNumber)) {
      errors.push('Invalid Aadhaar number format');
    }
    if (!validatePhone(body.personalDetails?.mobile)) {
      errors.push('Invalid mobile number format');
    }
    if (!validateEmail(body.personalDetails?.email)) {
      errors.push('Invalid email format');
    }

    // Loan details validation
    const loanAmount = parseFloat(body.loanDetails?.amount);
    if (isNaN(loanAmount) || loanAmount < 10000 || loanAmount > 5000000) {
      errors.push('Loan amount must be between ₹10,000 and ₹50,00,000');
    }

    if (!body.loanDetails?.tenure || body.loanDetails.tenure < 6 || body.loanDetails.tenure > 84) {
      errors.push('Tenure must be between 6 and 84 months');
    }

    // Address validation
    if (!body.addressDetails?.currentAddress?.addressLine1?.trim()) {
      errors.push('Current address is required');
    }
    if (!body.addressDetails?.currentAddress?.city?.trim()) {
      errors.push('City is required');
    }
    if (!body.addressDetails?.currentAddress?.pincode?.trim()) {
      errors.push('Pincode is required');
    }

    // Employment validation
    if (!body.employmentDetails?.employerName?.trim()) {
      errors.push('Employer name is required');
    }
    if (!body.employmentDetails?.grossSalary || body.employmentDetails.grossSalary <= 0) {
      errors.push('Gross salary is required');
    }

    // Geolocation is mandatory for all applications
    if (!body.geolocation?.latitude || !body.geolocation?.longitude) {
      errors.push('Location access is required. Please enable location permissions and try again.');
    }

    if (errors.length > 0) {
      console.log(`[submit-loan-application] Validation errors:`, errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we have an existing draft to update
    const draftId = body.draftId;
    let application: any;
    let applicationNumber: string = await generateApplicationNumber(supabase);

    if (draftId) {
      // Update existing draft application
      console.log(`[submit-loan-application] Updating existing draft: ${draftId}`);
      
      const { data: existingApp, error: fetchError } = await supabase
        .from('loan_applications')
        .select('id, application_number')
        .eq('id', draftId)
        .single();

      if (!fetchError && existingApp) {
        // Use existing application_number only if it's a proper LA number;
        // drafts from save-draft-application have null application_number
        if (existingApp.application_number && !existingApp.application_number.startsWith('DRAFT-')) {
          applicationNumber = existingApp.application_number;
        }

        // Update the draft to submitted status with proper application number
        const { data: updatedApp, error: updateError } = await supabase
          .from('loan_applications')
          .update({
            application_number: applicationNumber,
            requested_amount: loanAmount,
            tenure_months: body.loanDetails.tenure,
            current_stage: 'application',
            status: 'in_progress',
            latitude: body.geolocation?.latitude || null,
            longitude: body.geolocation?.longitude || null,
            geolocation_accuracy: body.geolocation?.accuracy || null,
            submitted_from_ip: clientIP,
            updated_at: new Date().toISOString()
          })
          .eq('id', draftId)
          .select()
          .single();

        if (updateError) {
          console.error('[submit-loan-application] Error updating draft:', updateError);
        } else {
          application = updatedApp;
          console.log(`[submit-loan-application] Draft updated: ${applicationNumber}`);
        }
      } else {
        console.log(`[submit-loan-application] Draft not found, creating new application`);
      }
    }

    console.log(`[submit-loan-application] Using application number: ${applicationNumber}`);

    // Upload documents to storage
    const uploadedDocuments: Array<{ type: string; path: string; name: string }> = [];
    
    if (body.documents && Array.isArray(body.documents)) {
      for (const doc of body.documents) {
        if (doc.base64 && doc.name && doc.type) {
          try {
            // Decode base64
            const base64Data = doc.base64.split(',')[1] || doc.base64;
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            // Generate unique filename
            const ext = doc.name.split('.').pop() || 'pdf';
            const fileName = `${formConfig.org_id}/${applicationNumber}/${doc.type}_${Date.now()}.${ext}`;
            
            const { error: uploadError } = await supabase.storage
              .from('loan-documents')
              .upload(fileName, binaryData, {
                contentType: doc.mimeType || 'application/octet-stream',
                upsert: false
              });

            if (uploadError) {
              console.error(`[submit-loan-application] Upload error for ${doc.type}:`, uploadError);
            } else {
              uploadedDocuments.push({
                type: doc.type,
                path: fileName,
                name: doc.name
              });
              console.log(`[submit-loan-application] Uploaded document: ${fileName}`);
            }
          } catch (uploadErr) {
            console.error(`[submit-loan-application] Document upload failed:`, uploadErr);
          }
        }
      }
    }

    // Create loan application only if not updated from draft
    if (!application) {
      const { data: newApp, error: appError } = await supabase
        .from('loan_applications')
        .insert({
          org_id: formConfig.org_id,
          form_id: formConfig.id || null,
          application_number: applicationNumber,
          product_type: formConfig.product_type,
          requested_amount: loanAmount,
          tenure_months: body.loanDetails.tenure,
          current_stage: 'application',
          status: 'in_progress',
          source: referrerUserId ? 'referral_link' : 'public_form',
          referred_by: referrerUserId,
          latitude: body.geolocation?.latitude || null,
          longitude: body.geolocation?.longitude || null,
          geolocation_accuracy: body.geolocation?.accuracy || null,
          submitted_from_ip: clientIP
        })
        .select()
        .single();

      if (appError) {
        console.error('[submit-loan-application] Error creating application:', appError);
        throw appError;
      }
      application = newApp;

      // Assign using round-robin
      try {
        const { data: assigneeId } = await supabase.rpc('get_next_assignee', {
          p_org_id: formConfig.org_id
        });
        
        if (assigneeId) {
          await supabase
            .from('loan_applications')
            .update({ assigned_to: assigneeId })
            .eq('id', application.id);
          console.log(`[submit-loan-application] Assigned application to user: ${assigneeId}`);
        }
      } catch (assignError) {
        console.log('[submit-loan-application] Round-robin assignment skipped (no assignable users configured)');
      }

      // Update referral count if this is a referral
      if (referrerUserId && body.referralCode) {
        await supabase
          .from('user_referral_codes')
          .update({ 
            applications_count: supabase.rpc('increment_counter', { row_id: body.referralCode }),
            updated_at: new Date().toISOString()
          })
          .eq('referral_code', body.referralCode);
      }
    }

    console.log(`[submit-loan-application] Created/Updated application: ${application.id}`);

    // Parse name into first/last
    const nameParts = body.personalDetails.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create a contact/lead for this applicant (marked as "New Lead")
    const publicPhone10 = normalizePhone(body.personalDetails.mobile);
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', formConfig.org_id)
      .or(phoneMatchFilter(publicPhone10))
      .limit(1)
      .maybeSingle();

    if (!existingContact) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          org_id: formConfig.org_id,
          first_name: firstName,
          last_name: lastName || null,
          phone: body.personalDetails.mobile,
          email: body.personalDetails.email || null,
          source: referrerUserId ? 'referral_link' : 'loan_application',
          status: 'new',
          referred_by: referrerUserId || null,
          address: body.addressDetails?.currentAddress?.addressLine1 || null,
          city: body.addressDetails?.currentAddress?.city || null,
          state: body.addressDetails?.currentAddress?.state || null,
          postal_code: body.addressDetails?.currentAddress?.pincode || null,
          company: body.employmentDetails?.employerName || null,
          job_title: body.employmentDetails?.designation || null,
          notes: `New Lead from Loan Application ${applicationNumber}`,
        })
        .select()
        .single();

      if (contactError) {
        console.error('[submit-loan-application] Error creating contact/lead:', contactError);
      } else {
        console.log(`[submit-loan-application] Created new lead: ${newContact.id}`);
      }
    } else {
      console.log(`[submit-loan-application] Contact already exists: ${existingContact.id}`);
    }

    // Create applicant record
    const { data: applicant, error: applicantError } = await supabase
      .from('loan_applicants')
      .insert({
        loan_application_id: application.id,
        applicant_type: 'primary',
        first_name: firstName,
        last_name: lastName,
        dob: body.personalDetails.dob || null,
        gender: body.personalDetails.gender || null,
        marital_status: body.personalDetails.maritalStatus || null,
        pan_number: body.personalDetails.panNumber?.toUpperCase(),
        aadhaar_number: body.personalDetails.aadhaarNumber?.replace(/\s/g, ''),
        mobile: body.personalDetails.mobile,
        email: body.personalDetails.email,
        father_name: body.personalDetails.fatherName || null,
        current_address: {
          line1: body.addressDetails.currentAddress.addressLine1,
          line2: body.addressDetails.currentAddress.addressLine2 || '',
          city: body.addressDetails.currentAddress.city,
          state: body.addressDetails.currentAddress.state || '',
          pincode: body.addressDetails.currentAddress.pincode
        },
        permanent_address: {
          line1: body.addressDetails.permanentAddress?.addressLine1 || body.addressDetails.currentAddress.addressLine1,
          line2: body.addressDetails.permanentAddress?.addressLine2 || body.addressDetails.currentAddress.addressLine2 || '',
          city: body.addressDetails.permanentAddress?.city || body.addressDetails.currentAddress.city,
          state: body.addressDetails.permanentAddress?.state || body.addressDetails.currentAddress.state || '',
          pincode: body.addressDetails.permanentAddress?.pincode || body.addressDetails.currentAddress.pincode
        },
        residence_type: body.addressDetails.residenceType || null
      })
      .select()
      .single();

    if (applicantError) {
      console.error('[submit-loan-application] Applicant creation error:', applicantError);
    }

    // Create employment record (only if applicant was created successfully)
    if (applicant) {
      const { error: employmentError } = await supabase
        .from('loan_employment_details')
        .insert({
          applicant_id: applicant.id,
          employment_type: body.employmentDetails.employmentType || 'salaried',
          employer_name: body.employmentDetails.employerName,
          employer_type: body.employmentDetails.employerType || null,
          designation: body.employmentDetails.designation || null,
          gross_monthly_salary: body.employmentDetails.grossSalary,
          net_monthly_salary: body.employmentDetails.netSalary || null,
          salary_bank_name: body.employmentDetails.bankName || null,
          salary_account_number: body.employmentDetails.accountNumber || null
        });

      if (employmentError) {
        console.error('[submit-loan-application] Employment creation error:', employmentError);
      }
    }

    // Create document records
    for (const doc of uploadedDocuments) {
      const { error: docError } = await supabase
        .from('loan_documents')
        .insert({
          loan_application_id: application.id,
          applicant_id: applicant?.id || null,
          document_type: doc.type,
          file_name: doc.name,
          file_path: doc.path,
          verification_status: 'pending'
        });

      if (docError) {
        console.error(`[submit-loan-application] Document record error for ${doc.type}:`, docError);
      }
    }

    console.log(`[submit-loan-application] Application ${applicationNumber} submitted successfully`);

    // Send WhatsApp application confirmation (non-blocking)
    try {
      console.log(`[submit-loan-application] Sending WhatsApp confirmation for public form application`);
      await fetch(`${supabaseUrl}/functions/v1/send-application-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: formConfig.org_id,
          applicant_name: body.personalDetails.fullName,
          applicant_phone: body.personalDetails.mobile,
          application_number: applicationNumber
        })
      });
    } catch (notifyError) {
      console.log('[submit-loan-application] WhatsApp confirmation skipped:', notifyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        applicationNumber,
        message: 'Your loan application has been submitted successfully!'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[submit-loan-application] Error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
