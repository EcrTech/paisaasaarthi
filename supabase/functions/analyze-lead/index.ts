import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { contact, searchQuery, contacts } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    // Handle search query - filter contacts based on criteria
    if (searchQuery && contacts) {
      const searchSystemPrompt = `You are a LOS search assistant. Your task is to filter contacts based on natural language search queries that map to contact fields.

Available contact fields:
- first_name, last_name: Contact name
- company: Company name
- job_title: Job title/designation
- email, phone: Contact information
- source: Lead source
- status: Contact status
- city, state, country: Location information
- website: Company website
- notes: Additional notes
- created_at: Creation date

Return ONLY a JSON object with this structure:
{
  "filteredContactIds": ["id1", "id2", "id3"]
}

Include contact IDs that match the search criteria. Be intelligent about matching - understand synonyms, partial matches, and combined criteria.

Examples:
- "designation Manager" -> Match job_title containing "Manager"
- "company in Mumbai" -> Match city = "Mumbai"
- "designation Manager, company in Mumbai" -> Match both conditions
- "age 30-40" -> You cannot filter by age as it's not a contact field, return empty array
- "source LinkedIn" -> Match source = "LinkedIn"`;

      const contactsSummary = contacts.map((c: any) => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        company: c.company,
        job_title: c.job_title,
        source: c.source,
        status: c.status,
        city: c.city,
        state: c.state,
        country: c.country,
        email: c.email,
        phone: c.phone
      }));

      const searchUserPrompt = `Search Query: "${searchQuery}"

Contacts to filter:
${JSON.stringify(contactsSummary, null, 2)}

Return the IDs of contacts that match the search criteria. Return ONLY valid JSON.`;

      console.log('Filtering contacts with query:', searchQuery);

      const searchResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: searchSystemPrompt,
          messages: [
            { role: 'user', content: searchUserPrompt }
          ],
        }),
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to process search query');
      }

      const searchData = await searchResponse.json();
      const searchResult = JSON.parse(searchData.content[0].text);

      console.log('Search result:', searchResult);

      return new Response(
        JSON.stringify(searchResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle single contact scoring
    if (!contact) {
      throw new Error('Either contact or searchQuery with contacts must be provided');
    }

    const systemPrompt = `You are a B2B lead scoring AI that evaluates lead quality on a 0-100 scale with HEAVY emphasis on pipeline stage.

SCORING FRAMEWORK (Total: 100 points):

1. PIPELINE STAGE (0-50 points) - PRIMARY FACTOR:
   Base Points by Stage:
   - Won/Closed Won: 50 points (probability 100%)
   - Negotiation/Contract Discussion: 45 points (probability 85%)
   - Proposal Sent: 40 points (probability 70%)
   - Demo/Presentation: 30 points (probability 50%)
   - Qualified/Interested: 20 points (probability 25%)
   - Contacted/Initial Discussion: 15 points (probability 15%)
   - New/Uncontacted: 10 points (probability 10%)
   - Lost/Disqualified: 0 points

   Probability Bonus (applied based on stage probability field):
   - If probability ≥ 80%: +10 points
   - If probability ≥ 60%: +5 points
   - This bonus is AUTOMATICALLY applied based on pipeline_stage.probability value

2. ACTIVITY ENGAGEMENT (0-20 points):
   Recent Activity Timing (0-8 points):
   - Activity within 7 days: 8 points
   - Activity within 14 days: 5 points
   - Activity within 30 days: 2 points
   - No activity in 30+ days: 0 points

   Communication Quality (0-12 points):
   - Meetings/demos completed: +4 points per type with activity
   - Emails exchanged: +4 points
   - Calls made: +4 points
   - Total activities ≥ 5: +4 bonus points

3. BUSINESS PROFILE (0-15 points):
   Company & Role Assessment (0-8 points):
   - Known company with complete info: 8 points
   - Medium business: 5 points
   - Basic company info: 3 points

   Decision-Making Level (0-7 points):
   - C-Suite (CEO, CFO, CTO, Owner, Partner): 7 points
   - VP/Director/Manager level: 4 points
   - Other roles: 2 points

4. DATA QUALITY (0-15 points):
   Lead Source Quality (0-8 points):
   - Direct referral/partnership: 8 points
   - Website inquiry/demo request: 6 points
   - Event/webinar: 4 points
   - Cold outreach/unknown: 2 points

   Information Completeness (0-7 points):
   - Complete profile (company, role, email, phone): 7 points
   - Basic information: 4 points
   - Minimal data: 2 points

CATEGORY ASSIGNMENT:
- 90-100: hot (Won or near-close deals with high probability)
- 75-89: warm (Active negotiation/proposals with good engagement)
- 55-74: cool (Qualified leads with some activity)
- 35-54: cold (Early stage or minimal engagement)
- 0-34: unqualified (Lost or no engagement)

CRITICAL SCORING RULES - ENFORCE STRICTLY:
- Won stage: MUST score 95+ minimum
- Negotiation stage (probability ≥ 80%): MUST score 80+ minimum
- Proposal stage (probability ≥ 60%): MUST score 65+ minimum
- Lost stage: CANNOT score above 30
- The probability bonus is MANDATORY when probability field is ≥ 60%

IMPORTANT: Use the pipeline_stage.probability field to apply the bonus points automatically!

Return ONLY valid JSON:
{
  "score": <number 0-100>,
  "category": "<hot|warm|cool|cold|unqualified>",
  "breakdown": {
    "Pipeline Stage": <points including probability bonus>,
    "Activity Engagement": <points>,
    "Business Profile": <points>,
    "Data Quality": <points>
  },
  "reasoning": "<brief explanation emphasizing pipeline stage and probability>"
}`;

    const contactData = {
      name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      company: contact.company,
      job_title: contact.job_title,
      email: contact.email,
      phone: contact.phone,
      status: contact.status,
      source: contact.source,
      city: contact.city,
      state: contact.state,
      country: contact.country,
      website: contact.website,
      notes: contact.notes,
      created_at: contact.created_at,
      pipeline_stage: {
        name: contact.pipeline_stage?.name || 'Not set',
        stage_order: contact.pipeline_stage?.stage_order || 0,
        probability: contact.pipeline_stage?.probability || 0
      },
      engagement_metrics: {
        total_activities: contact.engagement_metrics?.total_activities || 0,
        last_activity_date: contact.engagement_metrics?.last_activity_date || 'Never',
        days_since_last_activity: contact.engagement_metrics?.days_since_last_activity || 999,
        meetings_count: contact.engagement_metrics?.meetings_count || 0,
        calls_count: contact.engagement_metrics?.calls_count || 0,
        emails_count: contact.engagement_metrics?.emails_count || 0
      }
    };

    const userPrompt = `Analyze this B2B contact and provide a lead score:

${JSON.stringify(contactData, null, 2)}

Focus heavily on the pipeline_stage (especially stage_order) and engagement_metrics when scoring. Return JSON as specified.`;

    console.log('Scoring lead:', contactData.name);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      throw new Error('Failed to score lead');
    }

    const data = await response.json();
    const aiResponse = data.content[0].text;

    console.log('AI Response:', aiResponse);

    try {
      const scoreReport = JSON.parse(aiResponse);
      return new Response(
        JSON.stringify(scoreReport),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      throw new Error('Invalid AI response format');
    }
  } catch (error) {
    console.error('Error in analyze-lead function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
