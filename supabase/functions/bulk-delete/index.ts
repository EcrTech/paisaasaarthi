import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BulkDeleteRequest {
  tableName: 'contacts';
  recordIds: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Step 1: Extract and verify authenticated user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with service role for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[BulkDelete] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[BulkDelete] Authenticated user:', user.id);

    // Step 2: Get user's org_id from profiles (server-side, never trust client)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      console.error('[BulkDelete] Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User organization not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userOrgId = profile.org_id;
    console.log('[BulkDelete] User org_id:', userOrgId);

    // Step 3: Verify user has admin or super_admin role in their org
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', userOrgId)
      .in('role', ['admin', 'super_admin'])
      .single();

    if (roleError || !userRole) {
      console.error('[BulkDelete] Role verification failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[BulkDelete] User role verified:', userRole.role);

    // Step 4: Parse request body
    const { tableName, recordIds }: BulkDeleteRequest = await req.json();

    // Validate input
    if (!tableName || !recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: tableName and recordIds are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validTables = ['contacts'];
    if (!validTables.includes(tableName)) {
      return new Response(
        JSON.stringify({ error: 'Invalid table name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BulkDelete] Deleting ${recordIds.length} records from ${tableName}`);

    // Step 5: CRITICAL - Verify ALL records belong to user's org before deletion
    const { data: recordsToVerify, error: verifyError } = await supabase
      .from(tableName)
      .select('id, org_id')
      .in('id', recordIds);

    if (verifyError) {
      console.error('[BulkDelete] Verification error:', verifyError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if any records belong to other orgs
    const invalidRecords = recordsToVerify?.filter(r => r.org_id !== userOrgId) || [];
    if (invalidRecords.length > 0) {
      console.error('[BulkDelete] SECURITY VIOLATION: Attempted cross-org deletion', {
        userId: user.id,
        userOrgId,
        invalidRecords: invalidRecords.map(r => ({ id: r.id, org_id: r.org_id }))
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden: Cannot delete records from other organizations',
          invalidCount: invalidRecords.length,
          attemptedIds: invalidRecords.map(r => r.id)
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if all requested records were found
    const foundCount = recordsToVerify?.length || 0;
    if (foundCount !== recordIds.length) {
      console.warn('[BulkDelete] Some records not found', {
        requested: recordIds.length,
        found: foundCount
      });
    }

    // Step 6: Safe to delete - all records verified to belong to user's org
    const { error: deleteError, count } = await supabase
      .from(tableName)
      .delete()
      .in('id', recordIds);

    if (deleteError) {
      console.error('[BulkDelete] Delete error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete records', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 7: Log audit trail
    const auditLog = {
      user_id: user.id,
      org_id: userOrgId,
      action: 'bulk_delete',
      table_name: tableName,
      record_count: recordIds.length,
      record_ids: recordIds,
      timestamp: new Date().toISOString(),
      user_role: userRole.role
    };

    console.log('[BulkDelete] Audit log:', auditLog);

    // Optionally store in audit table if it exists
    try {
      await supabase.from('audit_logs').insert(auditLog);
    } catch (auditError) {
      // Don't fail the operation if audit logging fails
      console.warn('[BulkDelete] Audit logging failed:', auditError);
    }

    console.log(`[BulkDelete] Successfully deleted ${count} records from ${tableName}`);

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: count || recordIds.length,
        tableName,
        message: `Successfully deleted ${count || recordIds.length} record(s)`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BulkDelete] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
