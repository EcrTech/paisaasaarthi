import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import {
  safeBase64Encode,
  getPdfPageCount,
  extractPdfPages,
  getChunkConfig,
  mergeOcrData,
  getChunkPrompt,
  calculateProgress,
  type ParsingProgress
} from "../_shared/pdfUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOCUMENT_PROMPTS: Record<string, string> = {
  pan_card: `Extract the following from this PAN card image:
- pan_number: The PAN number (10 character alphanumeric)
- name: Full name as shown on card
- father_name: Father's name
- dob: Date of birth in YYYY-MM-DD format
Return ONLY valid JSON with these fields.`,

  aadhaar_card: `Extract the following from this Aadhaar card image:
- aadhaar_number: The 12-digit Aadhaar number (with or without spaces)
- name: Full name as shown
- dob: Date of birth in YYYY-MM-DD format
- gender: Male/Female
- address: Full address as shown (single string)
Return ONLY valid JSON with these fields.`,

  aadhaar_front: `Extract the following from this Aadhaar card FRONT side image:
- aadhaar_number: The 12-digit Aadhaar number (with or without spaces)
- name: Full name as shown
- dob: Date of birth in YYYY-MM-DD format
- gender: Male/Female
Return ONLY valid JSON with these fields.`,

  aadhaar_back: `Extract the following from this Aadhaar card BACK side image:
- aadhaar_number: The 12-digit Aadhaar number (with or without spaces)
- address: The complete address as a single flat string, combining all lines (e.g., "S/O Ram Kumar, 123 Main Street, City, State - 123456")
- vid: The VID (Virtual ID) number if visible
Return ONLY valid JSON with these fields.`,

  bank_statement: `Extract ONLY the bank account identification details from this bank statement. Return ONLY valid JSON.

- account_number: The bank account number
- ifsc_code: The IFSC code of the branch. IMPORTANT: IFSC codes follow the format: 4 letters + '0' (zero, NOT letter O) + 6 alphanumeric characters. The 5th character is ALWAYS the digit zero '0', never the letter 'O'.
- branch_name: The branch name and location
- account_holder_name: Account holder's full name exactly as printed
- bank_name: Name of the bank
- account_type: Type of account (Savings/Current/etc)

Return ONLY valid JSON with these 6 fields. Use null for missing values.`,

  salary_slip_1: `Extract the following from this salary slip:
- employee_name: Employee full name
- employee_id: Employee ID if visible
- employer_name: Company/employer name
- month: Month and year (e.g., "January 2024")
- date_of_joining: Date of joining/DOJ if visible (YYYY-MM-DD format, null if not found)
- gross_salary: Total gross salary (number only)
- basic_salary: Basic salary component (number only)
- hra: HRA component (number only)
- other_allowances: Sum of other allowances (number only)
- pf_deduction: PF deduction (number only)
- professional_tax: Professional tax (number only)
- tds: TDS deducted (number only)
- other_deductions: Sum of other deductions (number only)
- net_salary: Net/take-home salary (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values, null for missing date_of_joining.`,

  salary_slip_2: `Extract the following from this salary slip:
- employee_name: Employee full name
- employee_id: Employee ID if visible
- employer_name: Company/employer name
- month: Month and year (e.g., "January 2024")
- date_of_joining: Date of joining/DOJ if visible (YYYY-MM-DD format, null if not found)
- gross_salary: Total gross salary (number only)
- basic_salary: Basic salary component (number only)
- hra: HRA component (number only)
- other_allowances: Sum of other allowances (number only)
- pf_deduction: PF deduction (number only)
- professional_tax: Professional tax (number only)
- tds: TDS deducted (number only)
- other_deductions: Sum of other deductions (number only)
- net_salary: Net/take-home salary (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values, null for missing date_of_joining.`,

  salary_slip_3: `Extract the following from this salary slip:
- employee_name: Employee full name
- employee_id: Employee ID if visible
- employer_name: Company/employer name
- month: Month and year (e.g., "January 2024")
- date_of_joining: Date of joining/DOJ if visible (YYYY-MM-DD format, null if not found)
- gross_salary: Total gross salary (number only)
- basic_salary: Basic salary component (number only)
- hra: HRA component (number only)
- other_allowances: Sum of other allowances (number only)
- pf_deduction: PF deduction (number only)
- professional_tax: Professional tax (number only)
- tds: TDS deducted (number only)
- other_deductions: Sum of other deductions (number only)
- net_salary: Net/take-home salary (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values, null for missing date_of_joining.`,

  form_16_year_1: `Extract the following from this Form 16:
- employee_name: Employee full name
- pan: PAN number
- employer_name: Employer/company name
- employer_tan: Employer TAN number
- assessment_year: Assessment year (e.g., "2023-24")
- financial_year: Financial year (e.g., "2022-23")
- gross_salary: Gross total income (number only)
- total_deductions: Total deductions under Chapter VI-A (number only)
- taxable_income: Net taxable income (number only)
- tax_deducted: Total TDS deducted (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  form_16_year_2: `Extract the following from this Form 16:
- employee_name: Employee full name
- pan: PAN number
- employer_name: Employer/company name
- employer_tan: Employer TAN number
- assessment_year: Assessment year (e.g., "2022-23")
- financial_year: Financial year (e.g., "2021-22")
- gross_salary: Gross total income (number only)
- total_deductions: Total deductions under Chapter VI-A (number only)
- taxable_income: Net taxable income (number only)
- tax_deducted: Total TDS deducted (number only)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  itr_year_1: `Extract the following from this ITR acknowledgment/document:
- name: Assessee full name
- pan: PAN number
- assessment_year: Assessment year (e.g., "2023-24")
- itr_form_type: ITR form number (ITR-1, ITR-2, etc.)
- gross_total_income: Gross total income (number only)
- total_deductions: Total deductions claimed (number only)
- taxable_income: Total taxable income (number only)
- tax_payable: Total tax payable (number only)
- tax_paid: Tax already paid/TDS (number only)
- refund_due: Refund due if any (number only, 0 if not applicable)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  itr_year_2: `Extract the following from this ITR acknowledgment/document:
- name: Assessee full name
- pan: PAN number
- assessment_year: Assessment year (e.g., "2022-23")
- itr_form_type: ITR form number (ITR-1, ITR-2, etc.)
- gross_total_income: Gross total income (number only)
- total_deductions: Total deductions claimed (number only)
- taxable_income: Total taxable income (number only)
- tax_payable: Total tax payable (number only)
- tax_paid: Tax already paid/TDS (number only)
- refund_due: Refund due if any (number only, 0 if not applicable)
Return ONLY valid JSON with these fields. Use 0 for missing numeric values.`,

  disbursement_proof: `Extract the following from this UTR/disbursement proof document (bank transfer screenshot, NEFT/RTGS/IMPS confirmation, payment receipt):
- utr_number: The UTR (Unique Transaction Reference) number or transaction reference ID. IMPORTANT: Look for ANY transaction reference number on the document, including fields labeled "Transaction ID", "Txn ID", "Reference Number", "Ref No", "NEFT Reference", "RTGS Reference", "IMPS Reference", "CMS Reference", "CMS Ref No", "UTR No", or any similar alphanumeric reference code. This is the most critical field to extract.
- transaction_date: The date of the transaction (YYYY-MM-DD format)
- amount: The transferred amount (number only)
- beneficiary_name: Name of the beneficiary/payee
- beneficiary_account: Beneficiary account number if visible
- bank_name: Bank name if visible
- transaction_status: Transaction status (e.g., "Success", "Completed", "Processed")
Return ONLY valid JSON with these fields. Use null for missing values.`,

  utr_proof: `Extract the following from this UTR/disbursement proof document (bank transfer screenshot, NEFT/RTGS/IMPS confirmation, payment receipt):
- utr_number: The UTR (Unique Transaction Reference) number or transaction reference ID. IMPORTANT: Look for ANY transaction reference number on the document, including fields labeled "Transaction ID", "Txn ID", "Reference Number", "Ref No", "NEFT Reference", "RTGS Reference", "IMPS Reference", "CMS Reference", "CMS Ref No", "UTR No", or any similar alphanumeric reference code. This is the most critical field to extract.
- transaction_date: The date of the transaction (YYYY-MM-DD format)
- amount: The transferred amount (number only)
- beneficiary_name: Name of the beneficiary/payee
- beneficiary_account: Beneficiary account number if visible
- bank_name: Bank name if visible
- transaction_status: Transaction status (e.g., "Success", "Completed", "Processed")
Return ONLY valid JSON with these fields. Use null for missing values.`,

  rental_agreement: `Extract the following from this Rental Agreement:
- landlord_name: Name of the landlord/owner
- tenant_name: Name of the tenant/renter
- property_address: Complete address of the rented property
- rent_amount: Monthly rent amount (number only)
- security_deposit: Security deposit paid (number only)
- agreement_start_date: Start date of agreement (YYYY-MM-DD)
- agreement_end_date: End date of agreement (YYYY-MM-DD)
- agreement_duration: Duration in months (number only)
- registration_number: Registration number if registered
Return ONLY valid JSON with these fields. Use null for missing values.`,

  utility_bill: `Extract the following from this Utility Bill:
- customer_name: Name of the customer/account holder
- service_address: Service address shown on bill
- bill_date: Bill date (YYYY-MM-DD)
- due_date: Payment due date (YYYY-MM-DD)
- bill_amount: Total bill amount (number only)
- utility_type: Type of utility (Electricity/Water/Gas/Internet)
- account_number: Customer/account number
- provider_name: Utility provider/company name
Return ONLY valid JSON with these fields. Use null for missing values.`,
};

// Document types that benefit from chunked processing
const CHUNKABLE_DOC_TYPES = ['itr_year_1', 'itr_year_2', 'form_16_year_1', 'form_16_year_2'];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let parsedDocumentId: string | undefined;

  try {
    const reqBody = await req.json();
    const {
      documentId,
      documentType,
      filePath,
      // Chunking parameters (optional - for continuation invocations)
      currentPage = 1,
      totalPages = 0,
      accumulatedData = null,
    } = reqBody;

    const isFirstChunk = currentPage === 1 && totalPages === 0;
    console.log(`[ParseDocument] Processing: ${documentType}, ID: ${documentId}, Page: ${currentPage}/${totalPages || 'unknown'}`);

    parsedDocumentId = documentId;
    if (!documentId || !documentType || !filePath) {
      throw new Error("Missing required parameters: documentId, documentType, filePath");
    }

    // Fetch the document to get loan_application_id for syncing
    const { data: docRecord, error: docFetchError } = await supabase
      .from("loan_documents")
      .select("loan_application_id, ocr_data, parsing_status")
      .eq("id", documentId)
      .single();

    if (docFetchError) {
      console.warn(`[ParseDocument] Could not fetch document record:`, docFetchError);
    }
    const loanApplicationId = docRecord?.loan_application_id;

    // Download the document from storage
    console.log(`[ParseDocument] Downloading file: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("loan-documents")
      .download(filePath);

    if (downloadError) {
      console.error(`[ParseDocument] Download error:`, downloadError);
      throw new Error(`Failed to download document: ${downloadError.message}`);
    }

    if (!fileData || fileData.size === 0) {
      console.warn(`[ParseDocument] First download returned empty. Retrying...`);
      await new Promise(r => setTimeout(r, 1500));
      const { data: retryData, error: retryError } = await supabase.storage
        .from("loan-documents")
        .download(filePath);

      if (retryError || !retryData || retryData.size === 0) {
        console.error(`[ParseDocument] Retry also failed. Blob size: ${retryData?.size}`);
        throw new Error("Downloaded file is empty (0 bytes). Please re-upload the document.");
      }
      Object.defineProperty(fileData, 'size', { value: retryData.size });
      var fileDataToUse = retryData;
    } else {
      var fileDataToUse = fileData;
    }

    const arrayBuffer = await fileDataToUse.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.error(`[ParseDocument] ArrayBuffer is empty after conversion. Blob size was: ${fileDataToUse.size}`);
      throw new Error("File data is empty after conversion. Please re-upload the document.");
    }

    const fileBytes = new Uint8Array(arrayBuffer);

    // Detect file type from path or content
    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
    const isPdf = fileExtension === 'pdf' || fileDataToUse.type === 'application/pdf';
    const isChunkable = isPdf && CHUNKABLE_DOC_TYPES.includes(documentType);

    console.log(`[ParseDocument] File size: ${arrayBuffer.byteLength}, isPDF: ${isPdf}, isChunkable: ${isChunkable}`);

    let actualTotalPages = totalPages;
    let pdfBytesToParse = fileBytes;
    const chunkConfig = getChunkConfig(documentType);

    // For all PDFs, try to validate/decrypt the PDF to strip restrictions
    if (isPdf) {
      try {
        const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
        const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();
        console.log(`[ParseDocument] PDF validated: ${pageCount} pages`);

        const cleanedPdfBytes = await pdfDoc.save();
        pdfBytesToParse = new Uint8Array(cleanedPdfBytes);
        console.log(`[ParseDocument] PDF re-saved (stripped encryption), new size: ${cleanedPdfBytes.byteLength}`);
      } catch (pdfError) {
        console.warn(`[ParseDocument] PDF validation/cleanup failed:`, pdfError);
      }
    }

    // For PDFs, determine if we need chunked processing
    if (isPdf && isChunkable) {
      if (isFirstChunk) {
        actualTotalPages = await getPdfPageCount(fileBytes);
        console.log(`[ParseDocument] PDF has ${actualTotalPages} pages`);

        await supabase
          .from("loan_documents")
          .update({
            parsing_status: 'processing',
            parsing_started_at: new Date().toISOString(),
            parsing_progress: {
              current_page: currentPage,
              total_pages: actualTotalPages,
              percentage: 0,
            },
          })
          .eq("id", documentId);
      }

      const endPage = Math.min(currentPage + chunkConfig.pagesPerChunk - 1, actualTotalPages);
      if (actualTotalPages > chunkConfig.pagesPerChunk) {
        console.log(`[ParseDocument] Extracting pages ${currentPage}-${endPage} of ${actualTotalPages}`);
        pdfBytesToParse = await extractPdfPages(fileBytes, currentPage, endPage);
      }
    }

    // Convert to base64 safely
    const bytesToEncode = pdfBytesToParse.slice(0);
    const base64 = safeBase64Encode(bytesToEncode.buffer);

    if (!base64 || base64.length === 0) {
      throw new Error("File conversion to base64 resulted in empty data. Please re-upload the document.");
    }
    console.log(`[ParseDocument] Base64 encoded, length: ${base64.length}`);

    // Get the appropriate prompt for this document type
    const basePrompt = DOCUMENT_PROMPTS[documentType] || `Extract all relevant information from this document and return as JSON.`;

    // Adjust prompt for chunked processing
    const prompt = isPdf && isChunkable && actualTotalPages > chunkConfig.pagesPerChunk
      ? getChunkPrompt(
          basePrompt,
          documentType,
          currentPage,
          Math.min(currentPage + chunkConfig.pagesPerChunk - 1, actualTotalPages),
          actualTotalPages,
          accumulatedData,
          isFirstChunk
        )
      : basePrompt;

    // Build content blocks for Anthropic API
    const contentBlocks: any[] = [];

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
      const mimeType = fileDataToUse.type || "image/jpeg";
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType,
          data: base64,
        },
      });
    }

    contentBlocks.push({
      type: "text",
      text: prompt + "\n\nCRITICAL: Respond with ONLY the raw JSON object. No text before or after. No markdown. No code fences. No explanation.",
    });

    console.log(`[ParseDocument] Calling Claude Haiku for ${isPdf ? 'PDF' : 'image'} parsing`);

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
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
      console.error(`[ParseDocument] AI API error: ${aiResponse.status}`, errorText);

      await supabase
        .from("loan_documents")
        .update({
          parsing_status: 'failed',
          parsing_progress: {
            ...calculateProgress(currentPage, actualTotalPages, chunkConfig.pagesPerChunk),
            error: `AI API error: ${aiResponse.status}`,
            failed_at_page: currentPage,
          },
        })
        .eq("id", documentId);

      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits exhausted. Please add funds to continue.");
      }
      throw new Error(`AI parsing failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.content?.[0]?.text || "";
    console.log(`[ParseDocument] AI response received, length: ${content.length}`);

    // Parse the JSON from the response
    let parsedData: Record<string, any> = {};
    try {
      let jsonStr = content.trim();

      const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeFenceMatch) {
        jsonStr = codeFenceMatch[1].trim();
      } else {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = content.substring(firstBrace, lastBrace + 1);
        }
      }

      try {
        parsedData = JSON.parse(jsonStr);
      } catch (firstParseError) {
        console.warn(`[ParseDocument] First parse failed, attempting JSON repair...`);

        let repaired = jsonStr;
        const lastCompleteComma = repaired.lastIndexOf(',\n');
        if (lastCompleteComma > 0) {
          const afterComma = repaired.substring(lastCompleteComma + 2).trim();
          if (!afterComma.endsWith('}')) {
            repaired = repaired.substring(0, lastCompleteComma);
            const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
            const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
            for (let i = 0; i < openBrackets; i++) repaired += ']';
            for (let i = 0; i < openBraces; i++) repaired += '}';
          }
        }

        try {
          parsedData = JSON.parse(repaired);
          console.log(`[ParseDocument] JSON repair successful`);
        } catch (repairError) {
          console.error(`[ParseDocument] JSON repair also failed:`, repairError);
          console.error(`[ParseDocument] Raw content (first 500):`, content.substring(0, 500));
          parsedData = { raw_text: content, parse_error: true };
        }
      }

      console.log(`[ParseDocument] Parsed data keys:`, Object.keys(parsedData).join(', '));
    } catch (parseError) {
      console.error(`[ParseDocument] JSON parse error:`, parseError);
      console.error(`[ParseDocument] Raw content (first 500):`, content.substring(0, 500));
      parsedData = { raw_text: content, parse_error: true };
    }

    // Retry for UTR extraction if null on disbursement/utr proof images
    if ((documentType === 'disbursement_proof' || documentType === 'utr_proof') && !parsedData.utr_number && !parsedData.parse_error && !isPdf) {
      console.log(`[ParseDocument] UTR is null for image-based ${documentType}, retrying with focused prompt...`);
      try {
        const retryPrompt = `Look at this bank transaction receipt/screenshot carefully. Find the main transaction reference number or ID shown on the document. It may be labeled as "Transaction ID", "UTR", "Reference Number", "Ref No", "NEFT Ref", "RTGS Ref", "IMPS Ref", "CMS Ref", or similar. Return ONLY a JSON object like: {"utr_number": "THE_REFERENCE_NUMBER_HERE"}. If you truly cannot find any reference number, return {"utr_number": null}.\n\nCRITICAL: Respond with ONLY the raw JSON object. No text before or after. No markdown. No code fences.`;

        const mimeType = fileDataToUse?.type || "image/jpeg";
        const retryResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 500,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mimeType,
                      data: base64,
                    },
                  },
                  { type: "text", text: retryPrompt },
                ],
              },
            ],
          }),
        });

        if (retryResponse.ok) {
          const retryResult = await retryResponse.json();
          const retryContent = retryResult.content?.[0]?.text || "";
          const firstBrace = retryContent.indexOf('{');
          const lastBrace = retryContent.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            const retryJson = JSON.parse(retryContent.substring(firstBrace, lastBrace + 1));
            if (retryJson.utr_number) {
              console.log(`[ParseDocument] UTR retry successful: ${retryJson.utr_number}`);
              parsedData.utr_number = retryJson.utr_number;
            }
          }
        } else {
          const errText = await retryResponse.text();
          console.warn(`[ParseDocument] UTR retry failed: ${retryResponse.status}`, errText);
        }
      } catch (retryError) {
        console.warn(`[ParseDocument] UTR retry error:`, retryError);
      }
    }

    // Merge with accumulated data if this is a continuation
    let mergedData = parsedData;
    if (accumulatedData) {
      if (parsedData.parse_error) {
        console.warn(`[ParseDocument] Chunk parse failed, keeping accumulated data`);
        mergedData = accumulatedData;
      } else {
        mergedData = mergeOcrData(accumulatedData, parsedData, documentType);
        console.log(`[ParseDocument] Merged data with previous chunks`);
      }
    }

    // Determine if we need to continue with more chunks
    const nextPage = currentPage + chunkConfig.pagesPerChunk;
    const hasMorePages = isPdf && isChunkable && actualTotalPages > 1 && nextPage <= actualTotalPages;

    if (hasMorePages) {
      if (documentType === 'bank_statement' && mergedData.transactions) {
        delete mergedData.transactions;
      }

      const progress = calculateProgress(nextPage - 1, actualTotalPages, chunkConfig.pagesPerChunk);

      await supabase
        .from("loan_documents")
        .update({
          ocr_data: {
            ...mergedData,
            parsed_at: new Date().toISOString(),
            document_type: documentType,
            parsing_in_progress: true,
          },
          parsing_progress: progress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      console.log(`[ParseDocument] Triggering continuation for pages ${nextPage}-${Math.min(nextPage + chunkConfig.pagesPerChunk - 1, actualTotalPages)}`);

      fetch(`${supabaseUrl}/functions/v1/parse-loan-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          documentId,
          documentType,
          filePath,
          currentPage: nextPage,
          totalPages: actualTotalPages,
          accumulatedData: mergedData,
        }),
      }).then(res => {
        console.log(`[ParseDocument] Continuation triggered, status: ${res.status}`);
      }).catch(err => {
        console.error(`[ParseDocument] Failed to trigger continuation:`, err);
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: "processing",
          message: `Processing pages ${currentPage}-${nextPage - 1} of ${actualTotalPages}`,
          progress,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // This is the final chunk or a single-page document
    if (documentType === 'bank_statement' && mergedData.transactions) {
      console.log(`[ParseDocument] Stripping transactions array (${mergedData.transactions.length} entries) from bank statement`);
      delete mergedData.transactions;
    }

    const finalData: Record<string, any> = {
      ...mergedData,
      parsed_at: new Date().toISOString(),
      document_type: documentType,
    };
    if ('parsing_in_progress' in finalData) {
      delete finalData.parsing_in_progress;
    }

    const { error: updateError } = await supabase
      .from("loan_documents")
      .update({
        ocr_data: finalData,
        parsing_status: 'completed',
        parsing_completed_at: new Date().toISOString(),
        parsing_progress: actualTotalPages > 1
          ? calculateProgress(actualTotalPages, actualTotalPages, chunkConfig.pagesPerChunk)
          : { current_page: 1, total_pages: 1, chunks_completed: 1, total_chunks: 1 },
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      console.error(`[ParseDocument] Update error:`, updateError);
      throw new Error(`Failed to save parsed data: ${updateError.message}`);
    }

    console.log(`[ParseDocument] Successfully parsed and saved data for document ${documentId}`);

    // Auto-verify bank statements and utility bills after successful parsing
    const autoVerifyTypes = ['bank_statement', 'utility_bill'];
    if (autoVerifyTypes.includes(documentType) && !mergedData.parse_error) {
      const { error: verifyError } = await supabase
        .from("loan_documents")
        .update({
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      if (verifyError) {
        console.warn(`[ParseDocument] Failed to auto-verify ${documentType}:`, verifyError);
      } else {
        console.log(`[ParseDocument] Auto-verified ${documentType} document ${documentId}`);
      }
    }

    // === Sync date_of_joining from salary slips to loan_employment_details ===
    const isSalarySlip = documentType.startsWith('salary_slip');

    if (isSalarySlip && !mergedData.parse_error && loanApplicationId && mergedData.date_of_joining) {
      console.log(`[ParseDocument] Syncing date_of_joining from salary slip: ${mergedData.date_of_joining}`);

      const { data: applicant } = await supabase
        .from("loan_applicants")
        .select("id")
        .eq("loan_application_id", loanApplicationId)
        .eq("applicant_type", "primary")
        .maybeSingle();

      if (applicant) {
        const { data: employment } = await supabase
          .from("loan_employment_details")
          .select("id, date_of_joining")
          .eq("applicant_id", applicant.id)
          .maybeSingle();

        if (employment) {
          if (!employment.date_of_joining || employment.date_of_joining !== mergedData.date_of_joining) {
            const { error: empUpdateError } = await supabase
              .from("loan_employment_details")
              .update({ date_of_joining: mergedData.date_of_joining })
              .eq("id", employment.id);

            if (empUpdateError) {
              console.warn(`[ParseDocument] Failed to sync date_of_joining:`, empUpdateError);
            } else {
              console.log(`[ParseDocument] Updated date_of_joining: ${employment.date_of_joining} -> ${mergedData.date_of_joining}`);
            }
          }
        } else {
          const { error: empInsertError } = await supabase
            .from("loan_employment_details")
            .insert({
              applicant_id: applicant.id,
              employer_name: mergedData.employer_name || 'Unknown',
              gross_monthly_salary: mergedData.gross_salary || 0,
              net_monthly_salary: mergedData.net_salary || 0,
              date_of_joining: mergedData.date_of_joining,
              employee_id: mergedData.employee_id || null,
            });

          if (empInsertError) {
            console.warn(`[ParseDocument] Failed to create employment record:`, empInsertError);
          } else {
            console.log(`[ParseDocument] Created employment record with date_of_joining: ${mergedData.date_of_joining}`);
          }
        }
      }
    }


    const isAadhaarOrPan = documentType === 'aadhaar_card' || documentType === 'aadhar_card' || documentType === 'pan_card';

    if (isAadhaarOrPan && !mergedData.parse_error && loanApplicationId) {
      console.log(`[ParseDocument] Syncing OCR data to loan_applicants for ${documentType}`);

      const { data: applicant, error: applicantFetchError } = await supabase
        .from("loan_applicants")
        .select("id, dob, current_address, gender")
        .eq("loan_application_id", loanApplicationId)
        .eq("applicant_type", "primary")
        .maybeSingle();

      if (applicant && !applicantFetchError) {
        const updateData: Record<string, unknown> = {};

        if (mergedData.dob) {
          const newDob = mergedData.dob;
          const currentDob = applicant.dob;
          if (currentDob === '1990-01-01' || newDob !== currentDob) {
            const dobDate = new Date(newDob);
            if (!isNaN(dobDate.getTime())) {
              updateData.dob = newDob;
              console.log(`[ParseDocument] Updating DOB: ${currentDob} -> ${newDob}`);
            }
          }
        }

        if (documentType === 'aadhaar_card' || documentType === 'aadhar_card') {
          if (mergedData.aadhaar_number) {
            const cleanAadhaar = mergedData.aadhaar_number.replace(/\s/g, '');
            if (/^\d{12}$/.test(cleanAadhaar)) {
              updateData.aadhaar_number = cleanAadhaar;
              console.log(`[ParseDocument] Updating aadhaar_number from OCR`);
            }
          }

          if (mergedData.gender) {
            const normalizedGender = mergedData.gender.toLowerCase();
            const currentGender = (applicant.gender || '').toLowerCase();
            if (!currentGender || normalizedGender !== currentGender) {
              updateData.gender = mergedData.gender;
              console.log(`[ParseDocument] Updating gender: ${applicant.gender} -> ${mergedData.gender}`);
            }
          }

          if (mergedData.address) {
            const addressStr = mergedData.address;

            const pincodeMatch = addressStr.match(/(\d{6})\s*$/);
            const pincode = pincodeMatch ? pincodeMatch[1] : '';

            const statePatterns = [
              'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
              'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
              'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
              'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
              'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
              'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry'
            ];
            let state = '';
            for (const s of statePatterns) {
              if (addressStr.toLowerCase().includes(s.toLowerCase())) {
                state = s;
                break;
              }
            }

            updateData.current_address = {
              line1: addressStr,
              line2: '',
              city: '',
              state: state,
              pincode: pincode
            };

            console.log(`[ParseDocument] Updating address - state: ${state}, pincode: ${pincode}`);
          }
        }

        if (Object.keys(updateData).length > 0) {
          const { error: syncError } = await supabase
            .from("loan_applicants")
            .update(updateData)
            .eq("id", applicant.id);

          if (syncError) {
            console.warn(`[ParseDocument] Failed to sync OCR to applicant:`, syncError);
          } else {
            console.log(`[ParseDocument] Synced OCR data to applicant:`, updateData);
          }
        } else {
          console.log(`[ParseDocument] No updates needed for applicant (values already set)`);
        }
      } else {
        console.log(`[ParseDocument] No primary applicant found for application ${loanApplicationId}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "completed",
        data: mergedData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[ParseDocument] Error:`, error);

    try {
      const docId = parsedDocumentId;
      if (docId) {
        await supabase
          .from("loan_documents")
          .update({
            parsing_status: 'failed',
            parsing_progress: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
          })
          .eq("id", docId);
      }
    } catch (e) {
      console.error(`[ParseDocument] Failed to update error status:`, e);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
