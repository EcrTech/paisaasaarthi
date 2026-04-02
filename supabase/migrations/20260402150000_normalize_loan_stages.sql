-- =============================================================================
-- Normalize loan stages to 9 canonical values
-- lead → application → documents → evaluation → approved → disbursement → disbursed → closed
-- (rejected possible from any stage)
-- =============================================================================

BEGIN;

-- 2a. Remap existing data to canonical stages
UPDATE loan_applications SET current_stage = CASE current_stage
  WHEN 'application_login'     THEN 'application'
  WHEN 'video_kyc'             THEN 'application'
  WHEN 'document_collection'   THEN 'documents'
  WHEN 'credit_assessment'     THEN 'evaluation'
  WHEN 'assessment'            THEN 'evaluation'
  WHEN 'field_verification'    THEN 'evaluation'
  WHEN 'approval_pending'      THEN 'approved'
  WHEN 'sanctioned'            THEN 'approved'
  WHEN 'disbursement_pending'  THEN 'disbursement'
  WHEN 'disbursement_declined' THEN 'disbursement'
  WHEN 'cancelled'             THEN 'rejected'
  ELSE current_stage
END
WHERE current_stage IN (
  'application_login', 'video_kyc', 'document_collection',
  'credit_assessment', 'assessment', 'field_verification',
  'approval_pending', 'sanctioned',
  'disbursement_pending', 'disbursement_declined', 'cancelled'
);

-- 2b. Sync status from stage for all existing rows
UPDATE loan_applications SET status = CASE current_stage
  WHEN 'lead'         THEN 'draft'
  WHEN 'application'  THEN 'in_progress'
  WHEN 'documents'    THEN 'in_progress'
  WHEN 'evaluation'   THEN 'in_progress'
  WHEN 'approved'     THEN 'approved'
  WHEN 'disbursement' THEN 'approved'
  WHEN 'disbursed'    THEN 'approved'
  WHEN 'closed'       THEN 'closed'
  WHEN 'rejected'     THEN 'rejected'
  ELSE status
END
WHERE status != 'draft' OR current_stage = 'lead';

-- 2b. Auto-sync trigger: status derived from current_stage
CREATE OR REPLACE FUNCTION sync_status_from_stage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Preserve draft status: drafts are partial submissions that haven't been finalized yet
  IF TG_OP = 'INSERT' AND NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;
  -- On UPDATE, only sync status if stage actually changed
  IF TG_OP = 'UPDATE' AND OLD.current_stage = NEW.current_stage THEN
    RETURN NEW;
  END IF;

  NEW.status := CASE NEW.current_stage
    WHEN 'lead'         THEN 'draft'
    WHEN 'application'  THEN 'in_progress'
    WHEN 'documents'    THEN 'in_progress'
    WHEN 'evaluation'   THEN 'in_progress'
    WHEN 'approved'     THEN 'approved'
    WHEN 'disbursement' THEN 'approved'
    WHEN 'disbursed'    THEN 'approved'
    WHEN 'closed'       THEN 'closed'
    WHEN 'rejected'     THEN 'rejected'
    ELSE NEW.status
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_status ON loan_applications;
CREATE TRIGGER trigger_sync_status
  BEFORE INSERT OR UPDATE OF current_stage ON loan_applications
  FOR EACH ROW EXECUTE FUNCTION sync_status_from_stage();

-- 2c. Updated transition_loan_stage: validates forward transitions
CREATE OR REPLACE FUNCTION public.transition_loan_stage(
  p_application_id UUID,
  p_expected_current_stage TEXT,
  p_new_stage TEXT,
  p_new_status TEXT DEFAULT NULL,
  p_approved_by UUID DEFAULT NULL,
  p_approved_amount NUMERIC DEFAULT NULL,
  p_tenure_days INTEGER DEFAULT NULL,
  p_interest_rate NUMERIC DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_affected INTEGER;
  v_valid BOOLEAN;
BEGIN
  -- Validate transition: rejected allowed from any stage
  IF p_new_stage = 'rejected' THEN
    v_valid := true;
  ELSE
    v_valid := CASE
      WHEN p_expected_current_stage = 'lead'         AND p_new_stage = 'application'  THEN true
      WHEN p_expected_current_stage = 'application'  AND p_new_stage = 'documents'    THEN true
      WHEN p_expected_current_stage = 'application'  AND p_new_stage = 'evaluation'   THEN true
      WHEN p_expected_current_stage = 'documents'    AND p_new_stage = 'evaluation'   THEN true
      WHEN p_expected_current_stage = 'evaluation'   AND p_new_stage = 'approved'     THEN true
      WHEN p_expected_current_stage = 'approved'     AND p_new_stage = 'disbursement' THEN true
      WHEN p_expected_current_stage = 'disbursement' AND p_new_stage = 'disbursed'    THEN true
      WHEN p_expected_current_stage = 'disbursed'    AND p_new_stage = 'closed'       THEN true
      ELSE false
    END;
  END IF;

  IF NOT v_valid THEN
    RAISE WARNING 'Invalid stage transition: % -> %', p_expected_current_stage, p_new_stage;
    RETURN false;
  END IF;

  -- Status is now auto-synced via trigger, but allow explicit override
  UPDATE loan_applications
  SET current_stage = p_new_stage,
      status = COALESCE(p_new_status, status),
      approved_by = COALESCE(p_approved_by, approved_by),
      approved_amount = COALESCE(p_approved_amount, approved_amount),
      tenure_days = COALESCE(p_tenure_days, tenure_days),
      interest_rate = COALESCE(p_interest_rate, interest_rate),
      updated_at = now()
  WHERE id = p_application_id
    AND current_stage = p_expected_current_stage;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected > 0;
END;
$$;

-- 2d. Update get_los_dashboard_stats with new stage priority mapping
CREATE OR REPLACE FUNCTION get_los_dashboard_stats(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
BEGIN
  WITH stage_priority AS (
    SELECT
      contact_id,
      MAX(CASE current_stage
        WHEN 'closed'       THEN 7
        WHEN 'disbursed'    THEN 6
        WHEN 'disbursement' THEN 5
        WHEN 'approved'     THEN 4
        WHEN 'evaluation'   THEN 3
        WHEN 'documents'    THEN 3
        WHEN 'application'  THEN 3
        WHEN 'rejected'     THEN 1
        ELSE 2
      END) AS max_priority
    FROM loan_applications
    WHERE org_id = p_org_id
      AND status != 'draft'
      AND contact_id IS NOT NULL
    GROUP BY contact_id
  ),
  contact_cards AS (
    SELECT
      COUNT(*)::int AS total_apps,
      COUNT(*) FILTER (WHERE max_priority = 3)::int AS in_progress,
      COUNT(*) FILTER (WHERE max_priority IN (4, 5))::int AS pending_approval,
      COUNT(*) FILTER (WHERE max_priority = 6)::int AS disbursed,
      COUNT(*) FILTER (WHERE max_priority = 7)::int AS closed,
      COUNT(*) FILTER (WHERE max_priority = 1)::int AS rejected
    FROM stage_priority
  ),
  sanctioned AS (
    SELECT COALESCE(SUM(approved_amount), 0)::bigint AS total_sanctioned
    FROM loan_applications
    WHERE org_id = p_org_id
      AND approved_amount IS NOT NULL
      AND current_stage IN ('approved', 'disbursement', 'disbursed', 'closed')
  ),
  disbursed_amt AS (
    SELECT COALESCE(SUM(d.disbursement_amount), 0)::bigint AS total_disbursed
    FROM loan_disbursements d
    JOIN loan_applications a ON d.loan_application_id = a.id
    WHERE a.org_id = p_org_id
      AND d.status = 'completed'
  ),
  emi_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_emis,
      COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'pending' AND due_date < CURRENT_DATE))::int AS overdue_emis
    FROM loan_repayment_schedule
    WHERE org_id = p_org_id
  )
  SELECT json_build_object(
    'totalApps', cc.total_apps,
    'inProgress', cc.in_progress,
    'pendingApproval', cc.pending_approval,
    'disbursed', cc.disbursed,
    'closed', cc.closed,
    'rejected', cc.rejected,
    'totalSanctioned', s.total_sanctioned,
    'totalDisbursedAmount', da.total_disbursed,
    'pendingEMIs', e.pending_emis,
    'overdueEMIs', e.overdue_emis
  ) INTO result
  FROM contact_cards cc, sanctioned s, disbursed_amt da, emi_counts e;

  RETURN result;
END;
$$;

-- 2d. Update get_stage_distribution with new stage names
CREATE OR REPLACE FUNCTION get_stage_distribution(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.sort_order), '[]'::json)
  INTO result
  FROM (
    SELECT
      current_stage AS stage,
      COUNT(*)::int AS count,
      CASE current_stage
        WHEN 'lead'         THEN 0
        WHEN 'application'  THEN 1
        WHEN 'documents'    THEN 2
        WHEN 'evaluation'   THEN 3
        WHEN 'approved'     THEN 4
        WHEN 'disbursement' THEN 5
        WHEN 'disbursed'    THEN 6
        WHEN 'closed'       THEN 7
        WHEN 'rejected'     THEN 8
        ELSE 99
      END AS sort_order
    FROM loan_applications
    WHERE org_id = p_org_id AND status != 'draft'
    GROUP BY current_stage
  ) t;

  RETURN result;
END;
$$;

-- 2d. Update get_staff_performance with new stage priority mapping
CREATE OR REPLACE FUNCTION get_staff_performance(
  p_org_id uuid,
  p_from_date timestamptz,
  p_to_date timestamptz,
  p_agent_only boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
BEGIN
  WITH app_priority AS (
    SELECT
      la.assigned_to,
      la.contact_id,
      la.id,
      COALESCE(ld.disbursement_amount, la.approved_amount, la.requested_amount, 0) AS amount,
      CASE la.current_stage
        WHEN 'closed'       THEN 7
        WHEN 'disbursed'    THEN 6
        WHEN 'disbursement' THEN 5
        WHEN 'approved'     THEN 4
        WHEN 'evaluation'   THEN 3
        WHEN 'documents'    THEN 3
        WHEN 'application'  THEN 3
        WHEN 'rejected'     THEN 1
        ELSE 2
      END AS priority
    FROM loan_applications la
    LEFT JOIN loan_disbursements ld
      ON ld.loan_application_id = la.id AND ld.status = 'completed'
    WHERE la.org_id = p_org_id
      AND la.status != 'draft'
      AND la.assigned_to IS NOT NULL
      AND la.contact_id IS NOT NULL
      AND la.created_at BETWEEN p_from_date AND p_to_date
  ),
  deduped AS (
    SELECT DISTINCT ON (assigned_to, contact_id)
      assigned_to, contact_id, id, amount, priority
    FROM app_priority
    ORDER BY assigned_to, contact_id, priority DESC
  ),
  staff_agg AS (
    SELECT
      d.assigned_to AS user_id,
      COUNT(*)::int AS leads_assigned,
      COALESCE(SUM(d.amount), 0)::bigint AS leads_amount,
      COUNT(*) FILTER (WHERE d.priority = 3)::int AS applications_in_progress,
      COALESCE(SUM(d.amount) FILTER (WHERE d.priority = 3), 0)::bigint AS in_progress_amount,
      COUNT(*) FILTER (WHERE d.priority = 4)::int AS approvals,
      COALESCE(SUM(d.amount) FILTER (WHERE d.priority = 4), 0)::bigint AS approvals_amount,
      COUNT(*) FILTER (WHERE d.priority = 5)::int AS sanctions,
      COALESCE(SUM(d.amount) FILTER (WHERE d.priority = 5), 0)::bigint AS sanctions_amount,
      COUNT(*) FILTER (WHERE d.priority IN (6, 7))::int AS disbursements,
      COALESCE(SUM(d.amount) FILTER (WHERE d.priority IN (6, 7)), 0)::bigint AS total_disbursed_amount
    FROM deduped d
    GROUP BY d.assigned_to
  ),
  coll_rates AS (
    SELECT
      la.assigned_to AS user_id,
      COALESCE(SUM(rs.total_emi), 0) AS expected,
      COALESCE(SUM(rs.amount_paid), 0) AS collected
    FROM loan_repayment_schedule rs
    JOIN loan_applications la ON rs.loan_application_id = la.id
    WHERE la.org_id = p_org_id
      AND la.assigned_to IS NOT NULL
    GROUP BY la.assigned_to
  )
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.disbursements DESC), '[]'::json)
  INTO result
  FROM (
    SELECT
      sa.user_id,
      COALESCE(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), 'Unknown') AS user_name,
      sa.leads_assigned,
      sa.leads_amount,
      sa.applications_in_progress,
      sa.in_progress_amount,
      sa.approvals,
      sa.approvals_amount,
      sa.sanctions,
      sa.sanctions_amount,
      sa.disbursements,
      sa.total_disbursed_amount,
      CASE WHEN COALESCE(cr.expected, 0) > 0
        THEN ROUND((cr.collected / cr.expected) * 100)::int
        ELSE 0
      END AS collection_rate
    FROM staff_agg sa
    LEFT JOIN profiles p ON p.id = sa.user_id
    LEFT JOIN coll_rates cr ON cr.user_id = sa.user_id
    WHERE (NOT p_agent_only OR sa.user_id IN (
      SELECT user_id FROM user_roles
      WHERE org_id = p_org_id
        AND role IN ('sales_agent', 'support_agent')
        AND is_active = true
    ))
  ) t;

  RETURN result;
END;
$$;

COMMIT;
