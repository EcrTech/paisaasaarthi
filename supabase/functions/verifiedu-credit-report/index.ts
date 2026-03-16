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

    // Parse Experian response - extract key fields from INProfileResponse structure
    const profile = responseData?.INProfileResponse;
    const scoreSection = profile?.SCORE;
    const currentApp = profile?.Current_Application;
    const caisAccount = profile?.CAIS_Account;
    const capsSummary = profile?.TotalCAPS_Summary;

    // Extract credit score - Experian nests it at INProfileResponse.SCORE.BureauScore
    const bureauScore = parseInt(scoreSection?.BureauScore, 10);
    const creditScore = !isNaN(bureauScore) && bureauScore > 0 ? bureauScore : null;
    const scoreConfidence = scoreSection?.BureauScoreConfidLevel || null;

    // Extract account summary
    const accountSummary = caisAccount?.CAIS_Summary?.Credit_Account;
    const totalAccounts = parseInt(accountSummary?.CreditAccountTotal, 10) || 0;
    const activeAccounts = parseInt(accountSummary?.CreditAccountActive, 10) || 0;
    const overdueAccounts = parseInt(accountSummary?.CreditAccountOverdue, 10) || 0;
    const totalBalance = parseInt(accountSummary?.OutstandingBalanceAll, 10) || 0;

    // Extract enquiry summary
    const totalEnquiries = parseInt(capsSummary?.TotalCAPSLast180Days, 10) || 0;

    // Extract name from response
    const applicantName = currentApp?.Current_Applicant_Details?.First_Name
      || currentApp?.Current_Application_Details?.First_Name
      || name;

    const reportData: Record<string, any> = {
      bureau_type: 'experian',
      credit_score: creditScore,
      score_confidence: scoreConfidence,
      total_accounts: totalAccounts,
      active_accounts: activeAccounts,
      overdue_accounts: overdueAccounts,
      total_outstanding_balance: totalBalance,
      total_enquiries_180days: totalEnquiries,
      raw_response: responseData,
      name_on_report: applicantName,
      pan_on_report: pan.toUpperCase(),
      mobile_on_report: mobile,
      transaction_id: responseData?.Header?.ReportOrderNO || null,
      report_date: new Date().toISOString(),
      is_live_fetch: true,
    };

    console.log(`[verifiedu-credit-report] Experian score: ${reportData.credit_score}`);

    // Save verification record
    if (applicationId && applicantId) {
      const verificationRecord = {
        loan_application_id: applicationId,
        applicant_id: applicantId,
        verification_type: 'credit_bureau',
        verification_source: 'experian',
        status: creditScore ? 'success' : (scoreConfidence === 'L' ? 'no_record' : 'failed'),
        request_data: {
          bureau_type: 'experian',
          api_endpoint: 'credit-report-experian',
          pan: pan.toUpperCase(),
          timestamp: new Date().toISOString(),
        },
        response_data: reportData,
        remarks: creditScore
          ? `Experian credit score: ${creditScore}`
          : (scoreConfidence === 'L' ? 'No credit history found in Experian' : 'Experian report fetched but no score extracted'),
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
