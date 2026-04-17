import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';
import { logEdgeError, logStep, logBatchProgress, logValidationError } from '../_shared/errorLogger.ts';
import { downloadFile, deleteFromR2, R2_PUBLIC_BASE } from '../_shared/r2.ts';

const OPERATION_TIMEOUT = 20 * 60 * 1000; // 20 minutes
const MAX_RETRIES = 3;
const BATCH_SIZE = 500; // Reduced for better memory management
const PROGRESS_UPDATE_INTERVAL = 5000; // 5 seconds - more frequent updates

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ImportJob {
  id: string;
  org_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  import_type: string;
  target_id: string | null;
}

interface ContactRecord {
  org_id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  status?: string;
  source?: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  postal_code?: string;
  website?: string;
  linkedin_url?: string;
  notes?: string;
  created_by: string;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values.map(v => v.replace(/^"|"$/g, ''));
}

function normalizeHeader(header: string): string {
  return header.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let supabase: any;

  try {
    console.log('[INIT] Starting bulk import processor');
    
    supabase = getSupabaseClient();

    const { importJobId } = await req.json();
    
    if (!importJobId) {
      throw new Error('Missing importJobId');
    }

    console.log('[JOB] Processing job:', importJobId);

    // Fetch import job
    const { data: importJob, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', importJobId)
      .single() as { data: ImportJob | null; error: any };

    if (jobError || !importJob) {
      throw new Error(`Import job not found: ${jobError?.message}`);
    }

    console.log('[JOB] Found:', importJob.file_name, 'Type:', importJob.import_type);

    // Download file from R2
    await updateJobStage(supabase, importJobId, 'downloading', {
      message: 'Downloading file...'
    });

    const fileData = await downloadFile(supabase, 'import-files', importJob.file_path);
    const fileSizeKB = Math.round(fileData.size / 1024);
    console.log('[STORAGE] File downloaded:', fileSizeKB, 'KB');

    // Convert blob to text
    const csvText = await fileData.text();
    const lines = csvText.split('\n').filter((line: string) => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse headers
    await updateJobStage(supabase, importJobId, 'validating', {
      message: 'Validating CSV structure...',
      file_size_kb: fileSizeKB
    });

    const headers = parseCSVLine(lines[0]).map(h => normalizeHeader(h));
    console.log('[PARSE] Headers detected:', headers);
    
    // Validate required columns based on import type
    let requiredColumns: string[];
    switch (importJob.import_type) {
      case 'contacts':
        requiredColumns = ['first_name'];
        break;
      case 'email_recipients':
      case 'whatsapp_recipients':
        requiredColumns = ['email'];
        break;
      default:
        requiredColumns = ['email'];
    }
    
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Parse and process data
    await updateJobStage(supabase, importJobId, 'parsing', {
      message: 'Parsing CSV data...',
      headers_found: headers.length,
      total_batches: Math.ceil((lines.length - 1) / BATCH_SIZE)
    });

    const totalRows = lines.length - 1;
    let processedRows = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{row?: number; field?: string; message: string; sample?: string}> = [];
    let batch: any[] = [];
    let batchNumber = 0;
    let lastProgressUpdate = Date.now();

    let currentRowNumber = 1;
    for (let i = 1; i < lines.length; i++) {
      currentRowNumber = i + 1;
      const line = lines[i].trim();
      if (!line) continue;

      // Progress update every 100 rows during parsing
      if (i % 100 === 0) {
        const now = Date.now();
        if (now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL) {
          await updateJobProgress(supabase, importJobId, {
            total_rows: totalRows,
            processed_rows: processedRows,
            success_count: successCount,
            error_count: errorCount,
            current_stage: 'parsing',
            stage_details: {
              message: `Parsing row ${i} of ${totalRows}...`,
              rows_parsed: i
            }
          });
          lastProgressUpdate = now;
          console.log(`[PROGRESS] Parsed ${i}/${totalRows} rows`);
        }
      }

      try {
        const values = parseCSVLine(line);
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        // Map to target table structure
        let record: any;
        if (importJob.import_type === 'contacts') {
          record = {
            org_id: importJob.org_id,
            first_name: row.first_name,
            last_name: row.last_name || '',
            email: row.email || null,
            phone: row.phone || null,
            company: row.company || null,
            job_title: row.job_title || null,
            status: row.status || 'new',
            source: row.source || 'bulk_import',
            city: row.city || row.location_city || null,
            state: row.state || row.location_state || null,
            country: row.country || null,
            address: row.address || null,
            postal_code: row.postal_code || row.location_zip || null,
            website: row.website || null,
            linkedin_url: row.linkedin_url || null,
            notes: row.notes || null,
            created_by: importJob.user_id
          };
        } else if (importJob.import_type === 'email_recipients') {
          record = {
            campaign_id: importJob.target_id,
            contact_id: null,
            email: row.email,
            custom_data: row,
            status: 'pending'
          };
        } else if (importJob.import_type === 'whatsapp_recipients') {
          record = {
            campaign_id: importJob.target_id,
            contact_id: null,
            phone_number: row.phone,
            custom_data: row,
            status: 'pending'
          };
        } else if (importJob.import_type === 'redefine_repository') {
          // No validation needed here - already validated once at start
          record = {
            org_id: importJob.org_id,
            name: row.name,
            designation: row.designation || null,
            department: row.deppt || row.department || null,
            job_level: row.job_levelupdated || row.job_level_updated || row.job_level || null,
            linkedin_url: row.linkedin || null,
            mobile_number: row.mobilenumb || row.mobile_number || null,
            mobile_2: row.mobile2 || null,
            official_email: row.official || null,
            personal_email: row.personalemailid || row.personal_email || null,
            generic_email: row.generic_email_id || row.generic_email || null,
            industry_type: row.industry_type || null,
            sub_industry: row.sub_industry || null,
            company_name: row.company_name || null,
            address: row.address || null,
            location: row.location || null,
            city: row.city || null,
            state: row.state || null,
            zone: row.zone || null,
            tier: row.tier || null,
            pincode: row.pincode || null,
            website: row.website || null,
            turnover: row.turnover || null,
            employee_size: row.emp_size || row.employee_size || null,
            erp_name: row.erp_name || null,
            erp_vendor: row.erp_vendor || null,
            created_by: importJob.user_id
          };
        } else if (importJob.import_type === 'inventory') {
          record = {
            org_id: importJob.org_id,
            item_id_sku: row.item_id_sku,
            item_name: row.item_name,
            brand: row.brand,
            category: row.category,
            subcategory: row.subcategory || null,
            grade_class: row.grade_class || null,
            material: row.material || null,
            finish_coating: row.finish_coating || null,
            diameter_mm: row.diameter_mm,
            length_mm: row.length_mm,
            thread_pitch: row.thread_pitch || null,
            head_type: row.head_type || null,
            drive_type: row.drive_type || null,
            standard_spec: row.standard_spec || null,
            available_qty: parseFloat(row.available_qty) || 0,
            reorder_level: row.reorder_level ? parseFloat(row.reorder_level) : null,
            reorder_qty: row.reorder_qty ? parseFloat(row.reorder_qty) : null,
            uom: row.uom,
            storage_location: row.storage_location || null,
            warehouse_branch: row.warehouse_branch || null,
            supplier_name: row.supplier_name || null,
            supplier_code: row.supplier_code || null,
            last_purchase_date: row.last_purchase_date || null,
            last_purchase_price: row.last_purchase_price ? parseFloat(row.last_purchase_price) : null,
            lead_time_days: row.lead_time_days ? parseInt(row.lead_time_days) : null,
            purchase_order_no: row.purchase_order_no || null,
            selling_price: row.selling_price ? parseFloat(row.selling_price) : null,
            discount_pct: row.discount_pct ? parseFloat(row.discount_pct) : null,
            customer_project: row.customer_project || null,
            last_sale_date: row.last_sale_date || null,
            gst_pct: row.gst_pct ? parseFloat(row.gst_pct) : null,
            hsn_code: row.hsn_code || null,
            batch_no: row.batch_no || null,
            heat_no: row.heat_no || null,
            inspection_status: row.inspection_status || null,
            date_of_entry: row.date_of_entry || null,
            remarks_notes: row.remarks_notes || null,
            weight_per_unit: row.weight_per_unit ? parseFloat(row.weight_per_unit) : null,
            image_ref: row.image_ref || null,
            certificate_no: row.certificate_no || null,
            expiry_review_date: row.expiry_review_date || null,
            issued_to: row.issued_to || null,
            created_by: importJob.user_id
          };
        }

        batch.push(record);
        processedRows++;

        // Check if too many errors - stop processing
        if (errors.length >= 500) {
          console.error('[ERROR] Too many errors (>500), stopping import');
          await supabase.from('import_jobs').update({
            status: 'failed',
            error_count: errors.length,
            error_details: errors,
            completed_at: new Date().toISOString(),
            stage_details: {
              error: 'Import stopped: Too many errors',
              max_errors_reached: true
            }
          }).eq('id', importJobId);
          
          return new Response(JSON.stringify({
            success: false,
            error: 'Too many errors (>500)',
            errorCount: errors.length
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Process batch when full
        if (batch.length >= BATCH_SIZE) {
          batchNumber++;
          console.log(`[BATCH] Processing batch ${batchNumber} with ${batch.length} records`);
          
          const result = await processBatch(supabase, importJob, batch, batchNumber);
          successCount += result.inserted;
          
          if (result.skipped > 0) {
            console.log(`[BATCH] Skipped ${result.skipped} duplicate records in batch ${batchNumber}`);
          }
          
          batch = [];

          // Update progress after each batch WITH error details for real-time visibility
          await updateJobProgress(supabase, importJobId, {
            total_rows: totalRows,
            processed_rows: processedRows,
            success_count: successCount,
            error_count: errorCount,
            error_details: errors.slice(-100), // Save last 100 errors in real-time
            current_stage: 'inserting',
            stage_details: {
              message: `Inserted batch ${batchNumber} (${successCount} records inserted, ${errorCount} errors)`,
              batches_completed: batchNumber,
              total_batches: Math.ceil(totalRows / BATCH_SIZE)
            }
          });
          lastProgressUpdate = Date.now();
        }

      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          row: currentRowNumber,
          field: 'parsing',
          message: errorMessage,
          sample: line.substring(0, 100)
        });
        console.log(`[ERROR] Row ${currentRowNumber}: ${errorMessage}`);
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      batchNumber++;
      const result = await processBatch(supabase, importJob, batch, batchNumber);
      successCount += result.inserted;
    }

    console.log('[COMPLETE] Processed:', successCount, 'success,', errorCount, 'errors');

    // Finalize import
    await updateJobStage(supabase, importJobId, 'finalizing', {
      message: 'Finalizing import...',
      total_success: successCount,
      total_errors: errorCount
    });

    // Cleanup file from R2
    let deleteError = null;
    try {
      const r2Key = importJob.file_path.startsWith(R2_PUBLIC_BASE)
        ? importJob.file_path.slice(R2_PUBLIC_BASE.length + 1)
        : null;
      if (r2Key) {
        await deleteFromR2(r2Key);
        console.log('[CLEANUP] File deleted from R2 successfully');
      }
    } catch (err) {
      deleteError = err;
      console.error('[CLEANUP] Failed to delete file from R2:', err);
    }

    // Update final status
    const duration = Math.round((Date.now() - startTime) / 1000);
    await supabase.from('import_jobs').update({
      status: 'completed',
      current_stage: 'completed',
      total_rows: totalRows,
      processed_rows: processedRows,
      success_count: successCount,
      error_count: errorCount,
      error_details: errors.slice(-500), // Store up to 500 errors for better debugging
      completed_at: new Date().toISOString(),
      file_cleaned_up: !deleteError,
      file_cleanup_at: new Date().toISOString(),
      stage_details: {
        message: `Import completed in ${duration}s`,
        total_success: successCount,
        total_errors: errorCount
      }
    }).eq('id', importJobId);

    console.log('[SUCCESS] Import completed in', duration, 'seconds');

    return new Response(JSON.stringify({
      success: true,
      processed: successCount,
      errors: errorCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ERROR] Processing failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    if (supabase && req.body) {
      try {
        const body = await req.json();
        await supabase.from('import_jobs').update({
          status: 'failed',
          current_stage: 'failed',
          completed_at: new Date().toISOString(),
          error_details: [{
            error: errorMessage,
            stack: errorStack,
            timestamp: new Date().toISOString()
          }],
          stage_details: { error: errorMessage }
        }).eq('id', body.importJobId);
      } catch (updateError) {
        console.error('[ERROR] Failed to update job status:', updateError);
      }
    }

    return new Response(JSON.stringify({
      error: 'Processing failed',
      message: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function updateJobStage(supabase: any, jobId: string, stage: string, details: any) {
  await supabase.from('import_jobs').update({
    current_stage: stage,
    stage_details: details,
    updated_at: new Date().toISOString()
  }).eq('id', jobId);
}

async function updateJobProgress(supabase: any, jobId: string, progress: any) {
  await supabase.from('import_jobs').update({
    ...progress,
    updated_at: new Date().toISOString()
  }).eq('id', jobId);
}

async function processBatch(
  supabase: any, 
  importJob: ImportJob, 
  batch: any[], 
  batchNumber: number
): Promise<{ inserted: number; skipped: number }> {
  console.log('[DB] Inserting batch', batchNumber, 'with', batch.length, 'records');

  try {
    let tableName: string;
    let upsertOptions: any = {};
    let skippedCount = 0;

    if (importJob.import_type === 'contacts') {
      tableName = 'contacts';
      
      // Get all emails from batch
      const emailsToCheck = batch
        .map(r => r.email)
        .filter(email => email && email.trim() !== '');
      
      let existingEmails = new Set();
      
      // Check which emails already exist in database
      if (emailsToCheck.length > 0) {
        const { data: existingByEmail } = await supabase
          .from('contacts')
          .select('email')
          .eq('org_id', importJob.org_id)
          .in('email', emailsToCheck);
        
        existingEmails = new Set(
          (existingByEmail || []).map((r: any) => r.email?.trim()?.toLowerCase())
        );
      }
      
      // Deduplicate: skip emails that exist in DB or in batch
      const deduped = [];
      const seenInBatch = new Set();
      
      for (let i = batch.length - 1; i >= 0; i--) {
        const record = batch[i];
        const email = record.email?.trim()?.toLowerCase();
        
        if (!email) {
          // Allow records without email (phone can duplicate)
          deduped.unshift(record);
        } else if (existingEmails.has(email)) {
          // Skip: email exists in database
          skippedCount++;
          logValidationError(i, 'email', 'Duplicate email in database', email);
        } else if (seenInBatch.has(email)) {
          // Skip: email already seen in this batch
          skippedCount++;
          logValidationError(i, 'email', 'Duplicate email in batch', email);
        } else {
          // Add to batch
          seenInBatch.add(email);
          deduped.unshift(record);
        }
      }
      
      batch = deduped;
      
      if (skippedCount > 0) {
        console.log(`[DB] Batch ${batchNumber}: Filtered ${skippedCount} duplicate emails, inserting ${batch.length} records`);
      }
      // No upsertOptions - use simple insert for contacts
    } else if (importJob.import_type === 'email_recipients') {
      tableName = 'email_campaign_recipients';
      upsertOptions = {
        onConflict: 'email',
        ignoreDuplicates: false
      };
    } else if (importJob.import_type === 'whatsapp_recipients') {
      tableName = 'whatsapp_campaign_recipients';
      upsertOptions = {
        onConflict: 'phone_number',
        ignoreDuplicates: false
      };
    } else {
      throw new Error(`Unknown import type: ${importJob.import_type}`);
    }

    // Use insert for contacts, upsert for campaign recipients
    const { error } = (importJob.import_type === 'contacts')
      ? await supabase.from(tableName).insert(batch)
      : await supabase.from(tableName).upsert(batch, upsertOptions);

    if (error) {
      console.error('[DB] Batch insert failed:', error);
      throw error;
    }

    console.log('[DB] Batch', batchNumber, 'inserted successfully');
    return { inserted: batch.length, skipped: skippedCount };
  } catch (error) {
    console.error('[DB] Batch processing error:', error);
    throw error;
  }
}