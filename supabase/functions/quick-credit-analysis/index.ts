import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_PROMPT = `You are a senior credit analyst. Analyze this credit bureau report and provide a concise one-page executive summary in JSON format.

Return ONLY valid JSON with this structure:
{
  "applicant_name": "<name from report>",
  "pan": "<PAN from report or null>",
  "bureau_type": "<cibil|experian|equifax|crif>",
  "credit_score": <number or null>,
  "score_rating": "<Excellent|Good|Fair|Poor|Very Poor>",
  "report_date": "<date string>",
  "summary_stats": {
    "total_accounts": <number>,
    "active_accounts": <number>,
    "closed_accounts": <number>,
    "total_outstanding": <number>,
    "total_overdue": <number>,
    "overdue_accounts": <number>,
    "written_off_accounts": <number>,
    "enquiries_30d": <number>,
    "enquiries_90d": <number>,
    "enquiries_180d": <number>
  },
  "key_insights": [
    "<insight string - max 5 critical observations about creditworthiness, repayment behavior, risk flags>"
  ],
  "risk_flags": [
    "<red flag string - any concerning patterns like high DPD, write-offs, too many enquiries, overlapping loans>"
  ],
  "positive_indicators": [
    "<positive indicator string - good repayment history, low utilization, etc.>"
  ],
  "recommendation": "<1-2 sentence overall credit assessment and lending recommendation>",
  "dpd_summary": "<brief DPD history summary>"
}

Be specific and data-driven. Cite actual numbers from the report.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, applicationId } = await req.json();

    if (!filePath) {
      return new Response(JSON.stringify({ success: false, error: "Missing filePath" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("loan-documents")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert to base64 safely
    let binaryString = "";
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binaryString);

    const isPdf = filePath.endsWith(".pdf");
    const mimeType = isPdf ? "application/pdf" :
                     filePath.endsWith(".png") ? "image/png" :
                     filePath.endsWith(".jpg") || filePath.endsWith(".jpeg") ? "image/jpeg" :
                     "application/pdf";

    // Call Anthropic Claude Haiku
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const contentBlocks: any[] = [
      { type: "text", text: ANALYSIS_PROMPT },
    ];

    if (isPdf) {
      contentBlocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64Data,
        },
      });
    } else {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType,
          data: base64Data,
        },
      });
    }

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: contentBlocks,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("Anthropic API error:", aiResponse.status, errText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.content[0].text;

    // Parse JSON from AI response
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse analysis results");
    }

    return new Response(JSON.stringify({ success: true, data: analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Quick credit analysis error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
