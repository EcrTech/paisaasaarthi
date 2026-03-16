import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      applicationId,
      currentIndex,
      documentIds,
      accumulatedFindings,
      verificationId,
    } = await req.json();

    if (!applicationId) {
      return new Response(JSON.stringify({ error: "applicationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========== INITIAL CALL: gather documents and create progress record ==========
    if (currentIndex === undefined || currentIndex === null) {
      console.log(`[FraudDetection] Initial call for application ${applicationId}`);

      const { data: documents, error: docsError } = await supabase
        .from("loan_documents")
        .select("id, document_type, file_path, ocr_data, mime_type")
        .eq("loan_application_id", applicationId)
        .not("file_path", "is", null);

      if (docsError) throw docsError;
      if (!documents || documents.length === 0) {
        return new Response(
          JSON.stringify({ error: "No documents found for this application" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const docIds = documents.map((d: any) => d.id);
      console.log(`[FraudDetection] Found ${docIds.length} documents to analyze`);

      // Create/upsert progress record
      const progressData = {
        status: "processing",
        total_documents: docIds.length,
        processed: 0,
        current_document: "",
        findings: [],
      };

      // Try upsert first
      const { data: upsertedRow, error: upsertError } = await supabase
        .from("loan_verifications")
        .upsert(
          {
            loan_application_id: applicationId,
            verification_type: "document_fraud_check",
            status: "in_progress",
            verification_source: "ai_claude",
            response_data: progressData,
            verified_at: new Date().toISOString(),
            remarks: `Fraud check started: 0/${docIds.length} documents analyzed`,
          },
          { onConflict: "loan_application_id,verification_type" }
        )
        .select("id")
        .single();

      let verId: string;
      if (upsertError) {
        // Fallback: insert
        const { data: insertedRow, error: insertError } = await supabase
          .from("loan_verifications")
          .insert({
            loan_application_id: applicationId,
            verification_type: "document_fraud_check",
            status: "in_progress",
            verification_source: "ai_claude",
            response_data: progressData,
            verified_at: new Date().toISOString(),
            remarks: `Fraud check started: 0/${docIds.length} documents analyzed`,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        verId = insertedRow!.id;
      } else {
        verId = upsertedRow!.id;
      }

      // Fire self-referential call for first document
      const selfUrl = `${supabaseUrl}/functions/v1/detect-document-fraud`;
      fetch(selfUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId,
          currentIndex: 0,
          documentIds: docIds,
          accumulatedFindings: [],
          verificationId: verId,
        }),
      }).catch((err) => console.error("[FraudDetection] Self-chain trigger error:", err));

      return new Response(
        JSON.stringify({ status: "processing", verificationId: verId, totalDocuments: docIds.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== CHAINED CALL: process one document ==========
    console.log(`[FraudDetection] Processing document ${currentIndex + 1}/${documentIds.length}`);

    const findings = accumulatedFindings || [];
    const docId = documentIds[currentIndex];

    // Fetch document info
    const { data: doc, error: docError } = await supabase
      .from("loan_documents")
      .select("id, document_type, file_path, ocr_data, mime_type, file_name")
      .eq("id", docId)
      .single();

    if (docError || !doc) {
      console.error(`[FraudDetection] Failed to fetch document ${docId}:`, docError);
      findings.push({
        document_type: "unknown",
        risk_level: "unknown",
        confidence: 0,
        issues: ["Could not fetch document record"],
        details: "",
      });
    } else {
      // Try to analyze this document
      let finding: any;
      try {
        finding = await analyzeDocument(supabase, doc, ANTHROPIC_API_KEY);
      } catch (err) {
        console.error(`[FraudDetection] Error analyzing ${doc.document_type}:`, err);
        finding = {
          document_type: doc.document_type,
          risk_level: "unknown",
          confidence: 0,
          issues: [`Analysis error: ${err instanceof Error ? err.message : "Unknown error"}`],
          details: "",
        };
      }
      findings.push(finding);
      console.log(`[FraudDetection] ${doc.document_type}: ${finding.risk_level} risk`);
    }

    // Update progress in DB
    const processed = currentIndex + 1;
    const progressUpdate = {
      status: "processing",
      total_documents: documentIds.length,
      processed,
      current_document: doc?.document_type || "unknown",
      findings,
    };

    await supabase
      .from("loan_verifications")
      .update({
        response_data: progressUpdate,
        remarks: `Fraud check in progress: ${processed}/${documentIds.length} documents analyzed`,
      })
      .eq("id", verificationId);

    // ========== MORE DOCUMENTS? Chain next ==========
    const nextIndex = currentIndex + 1;
    if (nextIndex < documentIds.length) {
      const selfUrl = `${supabaseUrl}/functions/v1/detect-document-fraud`;
      fetch(selfUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId,
          currentIndex: nextIndex,
          documentIds,
          accumulatedFindings: findings,
          verificationId,
        }),
      }).catch((err) => console.error("[FraudDetection] Self-chain trigger error:", err));

      return new Response(
        JSON.stringify({ status: "processing", processed, total: documentIds.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ALL DONE: Cross-document checks + final result ==========
    console.log(`[FraudDetection] All ${documentIds.length} documents analyzed. Running cross-checks...`);

    // Fetch all OCR data for cross-document checks
    const { data: allDocs } = await supabase
      .from("loan_documents")
      .select("document_type, ocr_data")
      .eq("loan_application_id", applicationId)
      .not("ocr_data", "is", null);

    const ocrDataMap: Record<string, any> = {};
    if (allDocs) {
      for (const d of allDocs) {
        if (d.ocr_data && typeof d.ocr_data === "object") {
          ocrDataMap[d.document_type] = d.ocr_data;
        }
      }
    }

    const crossChecks = runCrossDocumentChecks(ocrDataMap);

    // Calculate overall risk
    const riskLevels = findings.map((r: any) => r.risk_level);
    const highCount = riskLevels.filter((r: string) => r === "high").length;
    const mediumCount = riskLevels.filter((r: string) => r === "medium").length;
    const failedChecks = crossChecks.filter((c: any) => c.status === "fail").length;

    let overallRisk = "low";
    let riskScore = 0;

    if (highCount > 0 || failedChecks >= 2) {
      overallRisk = "high";
      riskScore = Math.min(100, 60 + highCount * 15 + failedChecks * 10);
    } else if (mediumCount > 0 || failedChecks >= 1) {
      overallRisk = "medium";
      riskScore = Math.min(59, 30 + mediumCount * 10 + failedChecks * 10);
    } else {
      overallRisk = "low";
      riskScore = Math.max(0, mediumCount * 5);
    }

    const finalResult = {
      status: "completed",
      overall_risk: overallRisk,
      risk_score: riskScore,
      documents_analyzed: findings.length,
      findings,
      cross_document_checks: crossChecks,
      analyzed_at: new Date().toISOString(),
    };

    const finalStatus = overallRisk === "high" ? "failed" : overallRisk === "medium" ? "warning" : "success";

    await supabase
      .from("loan_verifications")
      .update({
        status: finalStatus,
        response_data: finalResult,
        verified_at: new Date().toISOString(),
        remarks: `Fraud check: ${overallRisk} risk (score: ${riskScore}). ${findings.length} documents analyzed.`,
      })
      .eq("id", verificationId);

    console.log(`[FraudDetection] Complete. Risk: ${overallRisk}, Score: ${riskScore}`);

    return new Response(
      JSON.stringify({ status: "completed", overall_risk: overallRisk, risk_score: riskScore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[FraudDetection] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ========== Analyze a single document ==========
async function analyzeDocument(supabase: any, doc: any, apiKey: string): Promise<any> {
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

  // Download from storage
  const { data: fileData, error: dlError } = await supabase.storage
    .from("loan-documents")
    .download(doc.file_path);

  if (dlError || !fileData) {
    return {
      document_type: doc.document_type,
      risk_level: "unknown",
      confidence: 0,
      issues: ["Could not download document for analysis"],
      details: "",
    };
  }

  const arrayBuffer = await fileData.arrayBuffer();

  // Check file size
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    return {
      document_type: doc.document_type,
      risk_level: "unknown",
      confidence: 0,
      issues: ["File too large for visual fraud analysis (>15MB). Manual review recommended."],
      details: `File size: ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(1)}MB`,
    };
  }

  // Native base64 encoding
  const base64 = base64Encode(new Uint8Array(arrayBuffer));
  const mimeType = doc.mime_type || "image/jpeg";
  const isPdf = mimeType === "application/pdf" || doc.file_path?.endsWith('.pdf');

  const systemPrompt = `You are a document fraud detection expert for Indian financial documents. Analyze the provided document image for signs of tampering, forgery, or manipulation. Look for:
1. Font inconsistencies - different fonts/sizes for key fields vs headers
2. Pixel artifacts - signs of digital editing, blur patches, misaligned elements
3. Color/lighting inconsistencies - different brightness/contrast in edited areas
4. Cut-paste artifacts - visible edges, mismatched backgrounds
5. Unrealistic values - salary amounts that seem fabricated, dates that don't make sense
6. Format anomalies - missing standard elements, unusual layouts for the document type
7. Watermark/logo issues - low resolution logos, missing expected watermarks

Respond ONLY with a valid JSON object (no markdown, no code blocks):
{
  "risk_level": "low" | "medium" | "high",
  "confidence": 0-100,
  "issues": ["list of specific issues found, empty if none"],
  "details": "brief explanation of findings"
}`;

  const contentBlocks: any[] = [
    {
      type: "text",
      text: `Analyze this ${doc.document_type.replace(/_/g, " ")} document for signs of fraud or tampering.`,
    },
  ];

  if (isPdf) {
    contentBlocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64,
      },
    });
  } else {
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: base64,
      },
    });
  }

  // Call Claude Haiku with retry on 429
  let aiResponse: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: contentBlocks,
          },
        ],
      }),
    });

    if (aiResponse.status === 429 && attempt === 0) {
      console.warn("[FraudDetection] Rate limited, waiting 2s before retry...");
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    break;
  }

  if (!aiResponse || !aiResponse.ok) {
    const status = aiResponse?.status || "unknown";
    return {
      document_type: doc.document_type,
      risk_level: "unknown",
      confidence: 0,
      issues: [`AI analysis failed (HTTP ${status})`],
      details: "",
    };
  }

  const aiData = await aiResponse.json();
  const content = aiData.content?.[0]?.text || "";

  let parsed;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { risk_level: "low", issues: [], details: "Could not parse AI response" };
  } catch {
    parsed = { risk_level: "low", issues: [], details: "Could not parse AI response" };
  }

  return {
    document_type: doc.document_type,
    risk_level: parsed.risk_level || "low",
    confidence: parsed.confidence || 0,
    issues: parsed.issues || [],
    details: parsed.details || "",
  };
}

// ========== Cross-document consistency checks ==========
function runCrossDocumentChecks(ocrDataMap: Record<string, any>): any[] {
  const crossChecks: any[] = [];

  // Name consistency
  const names: Record<string, string> = {};
  for (const [docType, ocr] of Object.entries(ocrDataMap)) {
    const ocrObj = ocr as Record<string, any>;
    const name = ocrObj.name || ocrObj.full_name || ocrObj.employee_name || ocrObj.account_holder_name;
    if (name && typeof name === "string") {
      names[docType] = name.trim().toLowerCase();
    }
  }
  if (Object.keys(names).length >= 2) {
    const uniqueNames = [...new Set(Object.values(names))];
    crossChecks.push({
      check: "Name consistency",
      status: uniqueNames.length === 1 ? "pass" : uniqueNames.length <= 2 ? "warning" : "fail",
      detail:
        uniqueNames.length === 1
          ? `Name matches across ${Object.keys(names).length} documents`
          : `Different names found: ${Object.entries(names).map(([k, v]) => `${k}: "${v}"`).join(", ")}`,
    });
  }

  // PAN consistency
  const pans: Record<string, string> = {};
  for (const [docType, ocr] of Object.entries(ocrDataMap)) {
    const ocrObj = ocr as Record<string, any>;
    const pan = ocrObj.pan_number || ocrObj.pan;
    if (pan && typeof pan === "string" && pan.length === 10) {
      pans[docType] = pan.toUpperCase();
    }
  }
  if (Object.keys(pans).length >= 2) {
    const uniquePans = [...new Set(Object.values(pans))];
    crossChecks.push({
      check: "PAN number consistency",
      status: uniquePans.length === 1 ? "pass" : "fail",
      detail:
        uniquePans.length === 1
          ? "PAN number matches across documents"
          : `Mismatched PAN numbers: ${Object.entries(pans).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
    });
  }

  // DOB consistency
  const dobs: Record<string, string> = {};
  for (const [docType, ocr] of Object.entries(ocrDataMap)) {
    const ocrObj = ocr as Record<string, any>;
    const dob = ocrObj.date_of_birth || ocrObj.dob;
    if (dob && typeof dob === "string") {
      dobs[docType] = dob;
    }
  }
  if (Object.keys(dobs).length >= 2) {
    const uniqueDobs = [...new Set(Object.values(dobs))];
    crossChecks.push({
      check: "Date of birth consistency",
      status: uniqueDobs.length === 1 ? "pass" : "fail",
      detail:
        uniqueDobs.length === 1
          ? "DOB matches across documents"
          : `Different DOBs found: ${Object.entries(dobs).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
    });
  }

  // Salary consistency across salary slips
  const salaries: Record<string, number> = {};
  for (const [docType, ocr] of Object.entries(ocrDataMap)) {
    if (!docType.startsWith("salary_slip")) continue;
    const ocrObj = ocr as Record<string, any>;
    const salary = ocrObj.net_salary || ocrObj.net_pay || ocrObj.gross_salary;
    if (salary && typeof salary === "number") {
      salaries[docType] = salary;
    }
  }
  if (Object.keys(salaries).length >= 2) {
    const vals = Object.values(salaries);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const maxDev = Math.max(...vals.map((v) => Math.abs(v - avg) / avg));
    crossChecks.push({
      check: "Salary consistency across slips",
      status: maxDev < 0.1 ? "pass" : maxDev < 0.3 ? "warning" : "fail",
      detail:
        maxDev < 0.1
          ? "Salary amounts are consistent across slips"
          : `Salary variation of ${(maxDev * 100).toFixed(0)}% detected across slips`,
    });
  }

  return crossChecks;
}
