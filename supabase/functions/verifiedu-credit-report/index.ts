import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CREDIT_BASE_URL = 'https://livecredit.verifiedu.in/api/CreditScore';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const verifieduToken = Deno.env.get('VERIFIEDU_TOKEN');
    const companyId = Deno.env.get('VERIFIEDU_COMPANY_ID');

    if (!verifieduToken || !companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'VerifiedU credit bureau credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { applicantId, applicationId, orgId, name, pan, mobile } = body;

    if (!name || !pan || !mobile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Name, PAN, and Mobile are required for Experian credit report' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verifiedu-credit-report] Fetching Experian report for PAN: ${pan.slice(0, 5)}*****`);

    // Call VerifiedU Experian API
    const apiUrl = `${CREDIT_BASE_URL}/credit-report-experian`;
    const requestBody = {
      Name: name,
      Pan: pan.toUpperCase(),
      Mobile: mobile.replace(/\D/g, '').slice(-10),
    };

    console.log(`[verifiedu-credit-report] Calling ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'token': verifieduToken,
        'companyid': companyId,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();
    console.log(`[verifiedu-credit-report] Response status: ${response.status}, length: ${responseText.length}`);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error('[verifiedu-credit-report] Failed to parse response as JSON');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid response from credit bureau API' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      console.error('[verifiedu-credit-report] API error:', responseData);
      return new Response(
        JSON.stringify({
          success: false,
          error: responseData?.MESSAGE || responseData?.message || `API returned HTTP ${response.status}`,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse Experian response - extract key fields
    // The response structure may vary; handle common patterns
    const creditScore = responseData?.CREDIT_SCORE
      || responseData?.DATA?.CREDIT_SCORE
      || responseData?.creditScore
      || null;

    const reportData = {
      bureau_type: 'experian',
      credit_score: creditScore,
      raw_response: responseData,
      name_on_report: responseData?.DATA?.NAME || responseData?.NAME || name,
      pan_on_report: pan.toUpperCase(),
      mobile_on_report: mobile,
      transaction_id: responseData?.TRANSACTION_ID || responseData?.DATA?.TRANSACTION_ID || null,
      report_date: new Date().toISOString(),
      is_live_fetch: true,
    };

    // Try to extract additional fields from common response structures
    const data = responseData?.DATA || responseData;
    if (data) {
      reportData.credit_score = reportData.credit_score || data.SCORE || data.score || null;
    }

    console.log(`[verifiedu-credit-report] Experian score: ${reportData.credit_score}`);

    // Save verification record
    if (applicationId && applicantId) {
      const verificationRecord = {
        loan_application_id: applicationId,
        applicant_id: applicantId,
        verification_type: 'credit_bureau',
        verification_source: 'experian',
        status: reportData.credit_score ? 'success' : 'failed',
        request_data: {
          bureau_type: 'experian',
          api_endpoint: 'credit-report-experian',
          pan: pan.toUpperCase(),
          timestamp: new Date().toISOString(),
        },
        response_data: reportData,
        remarks: reportData.credit_score
          ? `Experian credit score: ${reportData.credit_score}`
          : 'Experian report fetched but no score extracted',
        verified_at: new Date().toISOString(),
      };

      // Check for existing verification to update
      const { data: existing } = await supabase
        .from('loan_verifications')
        .select('id')
        .eq('loan_application_id', applicationId)
        .eq('verification_type', 'credit_bureau')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase.from('loan_verifications').update(verificationRecord).eq('id', existing.id);
        console.log(`[verifiedu-credit-report] Updated existing verification: ${existing.id}`);
      } else {
        await supabase.from('loan_verifications').insert(verificationRecord);
        console.log(`[verifiedu-credit-report] Created new verification record`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: reportData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[verifiedu-credit-report] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
