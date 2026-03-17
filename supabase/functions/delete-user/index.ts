import { getSupabaseClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = getSupabaseClient();

    // Verify the request is from an authenticated admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin, super_admin, or platform_admin
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    const isAuthorized =
      profile?.is_platform_admin ||
      userRole?.role === 'super_admin' ||
      userRole?.role === 'admin'

    if (!isAuthorized) {
      throw new Error('Insufficient permissions')
    }

    const { userId } = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    // Get target user's organization to verify authorization
    const { data: targetProfile } = await supabaseClient
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single()

    if (!targetProfile) {
      throw new Error('User not found')
    }

    // Only platform admins can delete users from other organizations
    if (!profile?.is_platform_admin) {
      const { data: requesterProfile } = await supabaseClient
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (targetProfile.org_id !== requesterProfile?.org_id) {
        throw new Error('Cannot delete users from other organizations')
      }
    }

    // Nullify user references across all related tables (SET NULL approach)
    // This preserves business data while removing user association
    const nullifyOps = [
      // Tables referencing auth.users
      supabaseClient.from('agent_call_sessions').update({ agent_id: null }).eq('agent_id', userId),
      supabaseClient.from('api_keys').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('automation_approvals').update({ requested_by: null }).eq('requested_by', userId),
      supabaseClient.from('automation_approvals').update({ reviewed_by: null }).eq('reviewed_by', userId),
      supabaseClient.from('contact_tag_assignments').update({ assigned_by: null }).eq('assigned_by', userId),
      supabaseClient.from('email_bulk_campaigns').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('email_conversations').update({ sent_by: null }).eq('sent_by', userId),
      supabaseClient.from('email_suppression_list').update({ suppressed_by: null }).eq('suppressed_by', userId),
      supabaseClient.from('email_templates').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('inventory_items').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('org_feature_access').update({ modified_by: null }).eq('modified_by', userId),
      supabaseClient.from('org_invites').update({ invited_by: null }).eq('invited_by', userId),
      supabaseClient.from('org_invites').update({ used_by: null }).eq('used_by', userId),
      supabaseClient.from('organization_subscriptions').update({ override_by: null }).eq('override_by', userId),
      supabaseClient.from('outbound_webhooks').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('payment_transactions').update({ initiated_by: null }).eq('initiated_by', userId),
      supabaseClient.from('redefine_data_repository').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('redefine_repository_audit').update({ changed_by: null }).eq('changed_by', userId),
      supabaseClient.from('saved_reports').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('service_usage_logs').update({ user_id: null }).eq('user_id', userId),
      supabaseClient.from('subscription_audit_log').update({ performed_by: null }).eq('performed_by', userId),
      supabaseClient.from('subscription_invoices').update({ waived_by: null }).eq('waived_by', userId),
      supabaseClient.from('subscription_pricing').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('wallet_transactions').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('whatsapp_bulk_campaigns').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('whatsapp_messages').update({ sent_by: null }).eq('sent_by', userId),
      // Tables referencing profiles
      supabaseClient.from('activity_participants').update({ user_id: null }).eq('user_id', userId),
      supabaseClient.from('call_logs').update({ agent_id: null }).eq('agent_id', userId),
      supabaseClient.from('contact_activities').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('contact_enrichment_logs').update({ enriched_by: null }).eq('enriched_by', userId),
      supabaseClient.from('contacts').update({ assigned_to: null }).eq('assigned_to', userId),
      supabaseClient.from('contacts').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('document_esign_requests').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('dpdp_breach_notifications').update({ triggered_by: null }).eq('triggered_by', userId),
      supabaseClient.from('dpdp_data_requests').update({ handled_by: null }).eq('handled_by', userId),
      supabaseClient.from('dpdp_pii_access_log').update({ user_id: null }).eq('user_id', userId),
      supabaseClient.from('email_automation_rules').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('error_logs').update({ user_id: null }).eq('user_id', userId),
      supabaseClient.from('loan_applications').update({ approved_by: null }).eq('approved_by', userId),
      supabaseClient.from('loan_applications').update({ assigned_to: null }).eq('assigned_to', userId),
      supabaseClient.from('loan_applications').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('loan_approvals').update({ approver_id: null }).eq('approver_id', userId),
      supabaseClient.from('loan_assignment_config').update({ last_assigned_user_id: null }).eq('last_assigned_user_id', userId),
      supabaseClient.from('loan_audit_log').update({ action_by: null }).eq('action_by', userId),
      supabaseClient.from('loan_deviations').update({ approved_by: null }).eq('approved_by', userId),
      supabaseClient.from('loan_deviations').update({ requested_by: null }).eq('requested_by', userId),
      supabaseClient.from('loan_documents').update({ verified_by: null }).eq('verified_by', userId),
      supabaseClient.from('loan_stage_history').update({ moved_by: null }).eq('moved_by', userId),
      supabaseClient.from('loan_verifications').update({ verified_by: null }).eq('verified_by', userId),
      supabaseClient.from('nupay_mandates').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('operation_queue').update({ user_id: null }).eq('user_id', userId),
      supabaseClient.from('sms_automation_rules').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('sms_messages').update({ sent_by: null }).eq('sent_by', userId),
      supabaseClient.from('support_tickets').update({ created_by: null }).eq('created_by', userId),
      supabaseClient.from('tasks').update({ assigned_by: null }).eq('assigned_by', userId),
      supabaseClient.from('tasks').update({ assigned_to: null }).eq('assigned_to', userId),
    ];

    // Run all nullify operations in parallel, ignore individual failures
    // (some tables may not exist or columns may be NOT NULL — that's ok)
    const results = await Promise.allSettled(nullifyOps);
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.log(`[delete-user] ${failures.length} nullify ops failed (non-critical), continuing...`);
    }

    // Delete from junction/ownership tables
    await supabaseClient.from('team_members').delete().eq('user_id', userId);
    await supabaseClient.from('user_roles').delete().eq('user_id', userId);

    // Delete teams managed by this user (if no other members)
    await supabaseClient.from('teams').update({ manager_id: null }).eq('manager_id', userId);

    // Delete profile
    await supabaseClient.from('profiles').delete().eq('id', userId);

    // Finally, delete from auth.users (requires service role)
    const { error: deleteAuthError } = await supabaseClient.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      throw deleteAuthError
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully from all organizations' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    console.error('[delete-user] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
