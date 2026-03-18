import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EARLYWAGES_API_URL = 'https://resources.earlywages.in/api/Experian/GetIndivisualCreditReportPdf';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const verifieduToken = Deno.env.get('VERIFIEDU_TOKEN');
    const companyId = Deno.env.get('VERIFIEDU_COMPANY_ID');

    if (!verifieduToken || !companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { applicantId, applicationId, orgId, name, pan, mobile } = body;

    if (!name || !pan || !mobile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Name, PAN, and Mobile are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);

    console.log(`[experian-credit-report] Fetching report for PAN: ${pan.slice(0, 5)}*****`);

    // Call EarlyWages Experian API
    const response = await fetch(EARLYWAGES_API_URL, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json',
        'token': verifieduToken,
        'companyid': companyId,
      },
      body: JSON.stringify({
        name,
        mobile: cleanMobile,
        panNumber: pan.toUpperCase(),
        rsType: 'PDF',
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[experian-credit-report] API error: ${errorText}`);
      return new Response(
        JSON.stringify({ success: false, error: `API returned HTTP ${response.status}: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiResponse = await response.json();
    console.log(`[experian-credit-report] API status: ${apiResponse.status}, message: ${apiResponse.message}`);

    if (apiResponse.status !== 'true' || apiResponse.statusCode !== '200' || !apiResponse.data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: apiResponse.message || apiResponse.error || 'API returned unsuccessful status',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reportData = apiResponse.data;
    const creditScore = reportData.credit_score;
    const pdfLink = reportData.credit_report_link;

    console.log(`[experian-credit-report] Credit score: ${creditScore}, PDF link: ${pdfLink ? 'present' : 'missing'}`);

    // Download the PDF from the link
    let storagePath: string | null = null;
    if (pdfLink) {
      try {
        const pdfResponse = await fetch(pdfLink, { signal: AbortSignal.timeout(30000) });
        if (pdfResponse.ok) {
          const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
          console.log(`[experian-credit-report] PDF downloaded: ${pdfBytes.length} bytes`);

          storagePath = orgId && applicationId
            ? `${orgId}/${applicationId}/experian_report_${Date.now()}.pdf`
            : `reports/experian_report_${pan.toUpperCase()}_${Date.now()}.pdf`;

          const { error: uploadError } = await supabase.storage
            .from('loan-documents')
            .upload(storagePath, pdfBytes, {
              contentType: 'application/pdf',
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) {
            console.error(`[experian-credit-report] Storage upload error:`, uploadError);
            storagePath = null;
          } else {
            console.log(`[experian-credit-report] PDF stored at: ${storagePath}`);
          }
        } else {
          console.error(`[experian-credit-report] PDF download failed: ${pdfResponse.status}`);
        }
      } catch (pdfErr) {
        console.error(`[experian-credit-report] PDF download error:`, pdfErr);
      }
    }

    const resultData = {
      bureau_type: 'experian',
      credit_score: creditScore || null,
      name_on_report: reportData.name || name,
      pan_on_report: reportData.pan || pan.toUpperCase(),
      mobile_on_report: reportData.mobile || cleanMobile,
      report_file_path: storagePath,
      credit_report_link: pdfLink,
      is_pdf_report: true,
      is_live_fetch: true,
      transaction_id: apiResponse.transaction_id,
      report_date: new Date().toISOString(),
      dob: reportData.dob || null,
      email: reportData.email || null,
      address: reportData.address || null,
    };

    // Save verification record
    if (applicationId && applicantId) {
      const verificationRecord = {
        loan_application_id: applicationId,
        applicant_id: applicantId,
        verification_type: 'credit_bureau',
        verification_source: 'experian',
        status: creditScore ? 'success' : 'failed',
        request_data: {
          bureau_type: 'experian',
          api_endpoint: 'earlywages-experian-pdf',
          pan: pan.toUpperCase(),
          timestamp: new Date().toISOString(),
        },
        response_data: resultData,
        remarks: creditScore
          ? `Experian credit score: ${creditScore}`
          : 'Experian report fetched but no score found',
        verified_at: new Date().toISOString(),
      };

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
      } else {
        await supabase.from('loan_verifications').insert(verificationRecord);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: resultData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[experian-credit-report] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
