import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const { importJobId } = await req.json();
    console.log('[ROLLBACK] Starting rollback for job:', importJobId);

    // Get import job details
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', importJobId)
      .single();

    if (jobError || !job) {
      throw new Error('Import job not found');
    }

    if (job.status !== 'completed') {
      throw new Error('Can only rollback completed imports');
    }

    let tableName: string;
    let deletedCount = 0;

    // Determine table and perform deletion
    if (job.import_type === 'contacts') {
      tableName = 'contacts';
      const { error: deleteError, count } = await supabase
        .from(tableName)
        .delete()
        .eq('created_by', job.user_id)
        .eq('org_id', job.org_id)
        .gte('created_at', job.started_at || job.created_at)
        .lte('created_at', job.completed_at);
      
      if (deleteError) throw deleteError;
      deletedCount = count || 0;

    } else if (job.import_type === 'email_recipients') {
      tableName = 'email_campaign_recipients';
      const { error: deleteError, count } = await supabase
        .from(tableName)
        .delete()
        .eq('campaign_id', job.target_id)
        .gte('created_at', job.started_at || job.created_at)
        .lte('created_at', job.completed_at);
      
      if (deleteError) throw deleteError;
      deletedCount = count || 0;

    } else if (job.import_type === 'whatsapp_recipients') {
      tableName = 'whatsapp_campaign_recipients';
      const { error: deleteError, count } = await supabase
        .from(tableName)
        .delete()
        .eq('campaign_id', job.target_id)
        .gte('created_at', job.started_at || job.created_at)
        .lte('created_at', job.completed_at);
      
      if (deleteError) throw deleteError;
      deletedCount = count || 0;

    } else {
      throw new Error(`Unknown import type: ${job.import_type}`);
    }

    console.log('[ROLLBACK] Deleted', deletedCount, 'records from', tableName);

    // Update import job status
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'rolled_back',
        current_stage: 'rolled_back',
        error_details: [{ message: `Rollback completed. Deleted ${deletedCount} records.` }]
      })
      .eq('id', importJobId);

    console.log('[ROLLBACK] Success!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ROLLBACK] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
