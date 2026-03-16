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

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id');

    if (orgsError) throw orgsError;

    for (const org of orgs || []) {
      // Fetch last 30 days of analytics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: analytics, error: analyticsError } = await supabase
        .from('campaign_analytics')
        .select('*')
        .eq('org_id', org.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (analyticsError) {
        console.error(`Error fetching analytics for org ${org.id}:`, analyticsError);
        continue;
      }

      if (!analytics || analytics.length === 0) {
        continue;
      }

      // Group by campaign
      const campaignMap = new Map<string, any[]>();
      analytics.forEach(record => {
        const key = `${record.campaign_id}-${record.campaign_type}`;
        if (!campaignMap.has(key)) {
          campaignMap.set(key, []);
        }
        campaignMap.get(key)!.push(record);
      });

      // Analyze each campaign
      for (const [campaignKey, metrics] of campaignMap.entries()) {
        const [campaignId, campaignType] = campaignKey.split('-');

        // Calculate aggregate metrics
        const totalSpend = metrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
        const totalConversions = metrics.reduce((sum, m) => sum + (m.conversions || 0), 0);
        const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.revenue || 0), 0);
        const avgRoas = totalRevenue / (totalSpend || 1);
        const avgCpa = totalSpend / (totalConversions || 1);

        // Get campaign name
        const tableName = campaignType === 'email' ? 'email_bulk_campaigns' : 'whatsapp_bulk_campaigns';
        const { data: campaign } = await supabase
          .from(tableName)
          .select('name, status')
          .eq('id', campaignId)
          .single();

        if (!campaign) continue;

        // Build AI analysis prompt
        const prompt = `Analyze this ${campaignType} campaign performance and provide actionable insights:

Campaign: ${campaign.name}
Status: ${campaign.status}
Period: Last 30 days

Metrics:
- Total Spend: ₹${totalSpend.toFixed(2)}
- ROAS: ${avgRoas.toFixed(2)}x (target: 2.5x)
- Conversions: ${totalConversions}
- CPA: ₹${avgCpa.toFixed(2)} (target: ₹60)
- Total Opens: ${metrics.reduce((sum, m) => sum + (m.open_count || 0), 0)}
- Total Clicks: ${metrics.reduce((sum, m) => sum + (m.click_count || 0), 0)}
- Bounces: ${metrics.reduce((sum, m) => sum + (m.bounce_count || 0), 0)}

Recent trend (last 7 days):
${metrics.slice(0, 7).map(m => `${m.date}: ${m.conversions} conversions, ₹${m.spend} spend`).join('\n')}

Identify:
1. Performance issues (low ROAS, high CPA, declining trends)
2. Opportunities (strong performers to scale, audience insights)
3. Specific actionable recommendations with expected impact

Respond ONLY with valid JSON in this exact format:
{
  "priority": "high|medium|low",
  "insight_type": "performance_drop|opportunity|optimization",
  "title": "Clear action statement (max 60 chars)",
  "description": "Why this matters (1 sentence)",
  "impact": "Quantified result (e.g., 'Save $500/week')",
  "supportingData": {
    "metric1": "value1",
    "metric2": "value2"
  },
  "analysis": "Your reasoning (2-3 sentences)",
  "suggestedAction": "Specific action to take"
}`;

        // Call Anthropic Claude Haiku
        try {
          const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 1024,
              system: 'You are an expert marketing analyst. Always respond with valid JSON only.',
              messages: [
                { role: 'user', content: prompt }
              ],
            }),
          });

          if (!aiResponse.ok) {
            console.error(`AI API error for campaign ${campaignId}:`, await aiResponse.text());
            continue;
          }

          const aiData = await aiResponse.json();
          const responseText = aiData.content[0].text;

          // Extract JSON from response
          let insights;
          try {
            insights = JSON.parse(responseText);
          } catch {
            const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonMatch) {
              insights = JSON.parse(jsonMatch[1]);
            } else {
              console.error(`Failed to parse AI response for campaign ${campaignId}`);
              continue;
            }
          }

          // Only store medium and high priority insights
          if (insights.priority === 'high' || insights.priority === 'medium') {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            const { error: insertError } = await supabase
              .from('campaign_insights')
              .insert({
                org_id: org.id,
                campaign_id: campaignId,
                priority: insights.priority,
                insight_type: insights.insight_type,
                title: insights.title,
                description: insights.description,
                impact: insights.impact,
                supporting_data: insights.supportingData,
                analysis: insights.analysis,
                suggested_action: insights.suggestedAction,
                expires_at: expiresAt.toISOString(),
              });

            if (insertError) {
              console.error(`Error inserting insight for campaign ${campaignId}:`, insertError);
            }
          }
        } catch (aiError) {
          console.error(`AI analysis error for campaign ${campaignId}:`, aiError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Campaign analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
