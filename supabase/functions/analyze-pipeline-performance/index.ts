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
      // Fetch pipeline stages
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('org_id', org.id)
        .order('stage_order');

      if (!stages || stages.length === 0) continue;

      // Fetch contacts with their stages
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, pipeline_stage_id, lead_score, updated_at, created_at')
        .eq('org_id', org.id);

      // Fetch recent pipeline movements (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: movements } = await supabase
        .from('pipeline_movement_history')
        .select('*, from_stage:pipeline_stages!from_stage_id(name), to_stage:pipeline_stages!to_stage_id(name)')
        .eq('org_id', org.id)
        .gte('moved_at', thirtyDaysAgo.toISOString());

      // Fetch lead scores
      const { data: leadScores } = await supabase
        .from('contact_lead_scores')
        .select('contact_id, total_score, score_category, updated_at')
        .eq('org_id', org.id);

      const scoreMap = new Map(leadScores?.map(s => [s.contact_id, s]) || []);

      // Calculate pipeline metrics
      const stageMetrics = new Map();

      for (const stage of stages) {
        const stageContacts = contacts?.filter(c => c.pipeline_stage_id === stage.id) || [];
        const stageMovements = movements?.filter(m => m.from_stage_id === stage.id) || [];

        // Calculate average days in stage
        const avgDaysInStage = stageMovements.length > 0
          ? stageMovements.reduce((sum, m) => sum + (m.days_in_previous_stage || 0), 0) / stageMovements.length
          : 0;

        // Find contacts stuck too long (>2x average)
        const stuckContacts = stageContacts.filter(c => {
          const daysInStage = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          return avgDaysInStage > 0 && daysInStage > avgDaysInStage * 2;
        });

        // Calculate conversion rate to next stage
        const movedToNext = movements?.filter(m =>
          m.from_stage_id === stage.id &&
          m.to_stage_id === stages[stages.indexOf(stage) + 1]?.id
        ).length || 0;

        const totalMoved = stageMovements.length || 1;
        const conversionRate = (movedToNext / totalMoved) * 100;

        // Lead score analysis for this stage
        const stageScores = stageContacts
          .map(c => scoreMap.get(c.id)?.total_score)
          .filter(s => s !== undefined) as number[];

        const avgLeadScore = stageScores.length > 0
          ? stageScores.reduce((sum, s) => sum + s, 0) / stageScores.length
          : 0;

        stageMetrics.set(stage.id, {
          stageName: stage.name,
          stageOrder: stage.stage_order,
          probability: stage.probability,
          contactCount: stageContacts.length,
          avgDaysInStage: Math.round(avgDaysInStage),
          stuckCount: stuckContacts.length,
          conversionRate: Math.round(conversionRate),
          avgLeadScore: Math.round(avgLeadScore),
        });
      }

      // Build AI analysis prompt
      const metricsArray = Array.from(stageMetrics.values());
      const prompt = `Analyze this sales pipeline performance and provide 2-3 actionable insights:

PIPELINE OVERVIEW:
${metricsArray.map(m => `
${m.stageName} (${m.probability}% probability):
- ${m.contactCount} contacts currently
- Avg. ${m.avgDaysInStage} days in stage
- ${m.stuckCount} contacts stuck (>2x average)
- ${m.conversionRate}% conversion to next stage
- Avg. lead score: ${m.avgLeadScore}/100
`).join('\n')}

RECENT ACTIVITY (Last 30 days):
- Total movements: ${movements?.length || 0}

Identify the TOP 2-3 most critical pipeline issues and opportunities:
1. BOTTLENECKS: Stages with high stuck count or low conversion
2. AT-RISK DEALS: High-probability stages (>70%) with contacts stuck >14 days
3. VELOCITY: Stage-specific recommendations to speed up pipeline

For each insight, provide clear actionable recommendations.

Respond with a JSON object containing an "insights" array where each insight has: priority (high/medium/low), insight_type (bottleneck/at_risk_deals/velocity_issue/optimization), title (max 60 chars), description, impact, supportingData (object with stage and metric), analysis, suggestedAction.`;

      // Call Anthropic Claude Haiku with tool use
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
            max_tokens: 2048,
            system: 'You are an expert sales operations analyst. Provide actionable pipeline insights.',
            messages: [
              { role: 'user', content: prompt }
            ],
            tools: [{
              name: 'create_pipeline_insights',
              description: 'Generate actionable pipeline insights',
              input_schema: {
                type: 'object',
                properties: {
                  insights: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                        insight_type: { type: 'string', enum: ['bottleneck', 'at_risk_deals', 'velocity_issue', 'optimization'] },
                        title: { type: 'string', description: 'Clear action statement (max 60 chars)' },
                        description: { type: 'string', description: 'Why this matters (1 sentence)' },
                        impact: { type: 'string', description: 'Expected result' },
                        supportingData: {
                          type: 'object',
                          properties: {
                            stage: { type: 'string' },
                            metric: { type: 'string' }
                          }
                        },
                        analysis: { type: 'string', description: 'Your reasoning (2-3 sentences)' },
                        suggestedAction: { type: 'string', description: 'Specific action to take' }
                      },
                      required: ['priority', 'insight_type', 'title', 'description', 'suggestedAction']
                    }
                  }
                },
                required: ['insights']
              }
            }],
            tool_choice: { type: 'tool', name: 'create_pipeline_insights' }
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error for org ${org.id}:`, errorText);
          continue;
        }

        const aiData = await aiResponse.json();
        console.log(`AI response for org ${org.id}:`, JSON.stringify(aiData));

        // Extract insights from tool use response
        let insightsArray = [];
        try {
          const toolUseBlock = aiData.content?.find((block: any) => block.type === 'tool_use');
          if (toolUseBlock) {
            insightsArray = toolUseBlock.input.insights || [];
          } else {
            // Fallback: try to parse text response
            const textBlock = aiData.content?.find((block: any) => block.type === 'text');
            if (textBlock) {
              const responseText = textBlock.text;
              console.log(`Fallback parsing for org ${org.id}, response:`, responseText);

              let parsed;
              try {
                parsed = JSON.parse(responseText);
              } catch {
                const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                if (jsonMatch) {
                  parsed = JSON.parse(jsonMatch[1]);
                } else {
                  const objectMatch = responseText.match(/\{[\s\S]*\}/);
                  if (objectMatch) {
                    parsed = JSON.parse(objectMatch[0]);
                  }
                }
              }

              if (parsed) {
                insightsArray = Array.isArray(parsed) ? parsed :
                               parsed.insights ? parsed.insights : [parsed];
              }
            }
          }
        } catch (parseError) {
          console.error(`Failed to parse AI response for org ${org.id}:`, parseError);
          continue;
        }

        // Store insights
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        for (const insight of insightsArray) {
          if (insight.priority === 'high' || insight.priority === 'medium') {
            const { error: insertError } = await supabase
              .from('campaign_insights')
              .insert({
                org_id: org.id,
                campaign_id: null,
                priority: insight.priority,
                insight_type: insight.insight_type,
                title: insight.title,
                description: insight.description,
                impact: insight.impact || null,
                supporting_data: insight.supportingData || null,
                analysis: insight.analysis || null,
                suggested_action: insight.suggestedAction,
                expires_at: expiresAt.toISOString(),
              });

            if (insertError) {
              console.error(`Error inserting pipeline insight for org ${org.id}:`, insertError);
            } else {
              console.log(`Successfully inserted insight for org ${org.id}: ${insight.title}`);
            }
          }
        }

        // Update pipeline benchmarks
        for (const [stageId, metrics] of stageMetrics.entries()) {
          const periodStart = new Date(thirtyDaysAgo);
          const periodEnd = new Date();

          await supabase
            .from('pipeline_benchmarks')
            .upsert({
              org_id: org.id,
              stage_id: stageId,
              avg_days_in_stage: metrics.avgDaysInStage,
              conversion_rate: metrics.conversionRate,
              total_contacts_processed: metrics.contactCount,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              calculated_at: new Date().toISOString(),
            }, {
              onConflict: 'org_id,stage_id,period_start,period_end'
            });
        }

      } catch (aiError) {
        console.error(`AI analysis error for org ${org.id}:`, aiError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Pipeline analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
