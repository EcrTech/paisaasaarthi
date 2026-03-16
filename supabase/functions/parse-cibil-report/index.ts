import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  safeBase64Encode,
  getPdfPageCount,
  extractPdfPages,
  getChunkConfig,
  mergeOcrData,
  calculateProgress,
  type ParsingProgress
} from "../_shared/pdfUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CIBIL_PROMPT = `You are an expert at parsing CIBIL/Credit Bureau reports. Analyze this document and extract the following information in JSON format:

{
  "credit_score": <number between 300-900, or null if not found>,
  "bureau_type": "<cibil|experian|equifax|crif - identify which bureau this report is from>",
  "active_accounts": <number of active loan/credit accounts, or 0>,
  "total_outstanding": <total outstanding amount in INR as number, or 0>,
  "total_overdue": <total overdue amount in INR as number, or 0>,
  "enquiry_count_30d": <number of credit enquiries in last 30 days, or 0>,
  "enquiry_count_90d": <number of credit enquiries in last 90 days, or 0>,
  "dpd_history": "<summary of Days Past Due history, e.g. 'No DPD in last 12 months' or '30+ DPD twice in last 24 months'>",
  "account_summary": {
    "secured_accounts": <number>,
    "unsecured_accounts": <number>,
    "closed_accounts": <number>
  },
  "accounts": [
    {
      "type": "<loan type>",
      "lender": "<lender name>",
      "amount": <sanctioned amount>,
      "outstanding": <current outstanding>,
      "status": "<active|closed|written_off>",
      "dpd": "<DPD status>"
    }
  ],
  "enquiries": [
    {
      "date": "<enquiry date>",
      "institution": "<institution name>",
      "purpose": "<purpose of enquiry>"
    }
  ],
  "report_date": "<date of the report in YYYY-MM-DD format if found, or null>",
  "name_on_report": "<name as it appears on the report>",
  "pan_on_report": "<PAN number if visible, or null>",
  "remarks": "<any important observations about credit health>"
}

Return ONLY the JSON object, no additional text. If a field cannot be determined, use null for strings and 0 for numbers.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const {
      filePath,
      applicationId,
      documentId,
      // Chunking parameters (optional)
      currentPage = 1,
      totalPages = 0,
      accumulatedData = null,
    } = await req.json();

    if (!filePath) {
      throw new Error("File path is required");
    }

    const isFirstChunk = currentPage === 1 && totalPages === 0;
    console.log(`[ParseCIBIL] Parsing report: ${filePath}, Page: ${currentPage}/${totalPages || 'unknown'}`);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("loan-documents")
      .download(filePath);

    if (downloadError) {
      console.error("[ParseCIBIL] Download error:", downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // Determine file type
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    const isPdf = fileExtension === 'pdf';
    const mimeType = isPdf
      ? 'application/pdf'
      : fileExtension === 'png'
        ? 'image/png'
        : 'image/jpeg';

    console.log("[ParseCIBIL] File type:", mimeType, "Size:", arrayBuffer.byteLength);

    const chunkConfig = getChunkConfig('cibil_report');
    let actualTotalPages = totalPages;
    let bytesToParse = fileBytes;

    // Handle PDF chunking
    if (isPdf) {
      if (isFirstChunk) {
        actualTotalPages = await getPdfPageCount(fileBytes);
        console.log(`[ParseCIBIL] PDF has ${actualTotalPages} pages`);

        // Update document status if documentId provided
        if (documentId) {
          await supabase
            .from("loan_documents")
            .update({
              parsing_status: 'processing',
              parsing_started_at: new Date().toISOString(),
              parsing_progress: calculateProgress(1, actualTotalPages, chunkConfig.pagesPerChunk),
            })
            .eq("id", documentId);
        }
      }

      // Extract chunk if needed
      if (actualTotalPages > chunkConfig.pagesPerChunk) {
        const endPage = Math.min(currentPage + chunkConfig.pagesPerChunk - 1, actualTotalPages);
        console.log(`[ParseCIBIL] Extracting pages ${currentPage}-${endPage} of ${actualTotalPages}`);
        bytesToParse = await extractPdfPages(fileBytes, currentPage, endPage);
      }
    }

    // Convert file to base64 SAFELY
    const base64Data = safeBase64Encode(bytesToParse.buffer);

    // Build context-aware prompt for chunked processing
    let prompt = CIBIL_PROMPT;
    if (!isFirstChunk && accumulatedData) {
      const prevSummary = accumulatedData.credit_score
        ? `Score: ${accumulatedData.credit_score}, ${accumulatedData.active_accounts || 0} active accounts found`
        : 'Basic info extracted';

      prompt = `You are continuing to analyze pages ${currentPage}-${Math.min(currentPage + chunkConfig.pagesPerChunk - 1, actualTotalPages)} of a ${actualTotalPages}-page credit bureau report.

Previous pages contained: ${prevSummary}

For THIS chunk only, extract any NEW account details, enquiries, or information not in the previous analysis.

${CIBIL_PROMPT}

Important: Only return NEW data found in these pages. The credit score and basic info were already captured.`;
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    console.log("[ParseCIBIL] Using Anthropic Claude Haiku");

    const contentBlocks: any[] = [];

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

    contentBlocks.push({ type: "text", text: prompt });

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: chunkConfig.maxTokens,
        messages: [
          {
            role: "user",
            content: contentBlocks,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[ParseCIBIL] AI API error:", errorText);

      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits exhausted. Please add funds to continue.");
      }
      throw new Error(`AI parsing failed: ${aiResponse.status}`);
    }

    const result = await aiResponse.json();
    const responseText = result.content?.[0]?.text;

    if (!responseText) {
      throw new Error("No response from AI model");
    }

    console.log("[ParseCIBIL] AI Response length:", responseText.length);

    let parsedData;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not parse AI response as JSON");
    }

    console.log("[ParseCIBIL] Parsed data:", JSON.stringify(parsedData).substring(0, 500));

    // Merge with accumulated data if continuation
    let mergedData = parsedData;
    if (accumulatedData) {
      mergedData = mergeOcrData(accumulatedData, parsedData, 'cibil_report');
      console.log("[ParseCIBIL] Merged with previous chunks");
    }

    // Check if we need to continue with more chunks
    const nextPage = currentPage + chunkConfig.pagesPerChunk;
    const hasMorePages = isPdf && actualTotalPages > 1 && nextPage <= actualTotalPages;

    if (hasMorePages) {
      // Update progress if documentId provided
      if (documentId) {
        const progress = calculateProgress(nextPage - 1, actualTotalPages, chunkConfig.pagesPerChunk);
        await supabase
          .from("loan_documents")
          .update({
            ocr_data: { ...mergedData, parsing_in_progress: true },
            parsing_progress: progress,
          })
          .eq("id", documentId);
      }

      // Trigger self-invocation for next chunk
      console.log(`[ParseCIBIL] Triggering continuation for pages ${nextPage}-${Math.min(nextPage + chunkConfig.pagesPerChunk - 1, actualTotalPages)}`);

      fetch(`${supabaseUrl}/functions/v1/parse-cibil-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          filePath,
          applicationId,
          documentId,
          currentPage: nextPage,
          totalPages: actualTotalPages,
          accumulatedData: mergedData,
        }),
      }).then(res => {
        console.log(`[ParseCIBIL] Continuation triggered, status: ${res.status}`);
      }).catch(err => {
        console.error(`[ParseCIBIL] Failed to trigger continuation:`, err);
      });

      // Return immediately with processing status
      return new Response(
        JSON.stringify({
          success: true,
          status: "processing",
          message: `Processing pages ${currentPage}-${nextPage - 1} of ${actualTotalPages}`,
          data: mergedData,
          filePath
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Final chunk or single page - mark as completed
    if (documentId) {
      await supabase
        .from("loan_documents")
        .update({
          ocr_data: mergedData,
          parsing_status: 'completed',
          parsing_completed_at: new Date().toISOString(),
          parsing_progress: calculateProgress(actualTotalPages || 1, actualTotalPages || 1, chunkConfig.pagesPerChunk),
        })
        .eq("id", documentId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "completed",
        data: mergedData,
        filePath
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[ParseCIBIL] Error:", errorMessage);

    // Try to update status to failed
    try {
      const { documentId } = await req.clone().json();
      if (documentId) {
        await supabase
          .from("loan_documents")
          .update({
            parsing_status: 'failed',
            parsing_progress: { error: errorMessage },
          })
          .eq("id", documentId);
      }
    } catch (e) {
      console.error("[ParseCIBIL] Failed to update error status:", e);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
