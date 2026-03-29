-- Phase 5: Remaining RPC Conversions
-- 5a: get_staff_performance — replaces 5 queries + heavy client-side aggregation
-- 5b: get_application_emi_stats — replaces 6 sequential queries in EMIDashboard

-- ============================================================
-- 5a: Staff Performance — server-side aggregation with contact dedup
-- ============================================================

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
        WHEN 'closed' THEN 7
        WHEN 'disbursed' THEN 6
        WHEN 'disbursement_pending' THEN 5
        WHEN 'sanctioned' THEN 5
        WHEN 'approval_pending' THEN 4
        WHEN 'credit_assessment' THEN 3
        WHEN 'field_verification' THEN 3
        WHEN 'document_collection' THEN 3
        WHEN 'application_login' THEN 3
        WHEN 'assessment' THEN 3
        WHEN 'rejected' THEN 1
        WHEN 'cancelled' THEN 1
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
      COUNT(*) FILTER (WHERE d.priority >= 4)::int AS approvals,
      COALESCE(SUM(d.amount) FILTER (WHERE d.priority >= 4), 0)::bigint AS approvals_amount,
      COUNT(*) FILTER (WHERE d.priority >= 5)::int AS sanctions,
      COALESCE(SUM(d.amount) FILTER (WHERE d.priority >= 5), 0)::bigint AS sanctions_amount,
      COUNT(*) FILTER (WHERE d.priority >= 6)::int AS disbursements,
      COALESCE(SUM(d.amount) FILTER (WHERE d.priority >= 6), 0)::bigint AS total_disbursed_amount
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

-- ============================================================
-- 5b: Per-application EMI stats — replaces 6 sequential queries
-- ============================================================

CREATE OR REPLACE FUNCTION get_application_emi_stats(
  p_application_id uuid,
  p_org_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
  today date := CURRENT_DATE;
BEGIN
  WITH counts AS (
    SELECT
      COUNT(*)::int AS total_emis,
      COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_emis,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_emis,
      COUNT(*) FILTER (
        WHERE status = 'overdue'
        OR (status = 'pending' AND due_date < today)
      )::int AS overdue_emis,
      COALESCE(SUM(total_emi), 0)::bigint AS total_amount,
      COALESCE(SUM(amount_paid), 0)::bigint AS amount_paid
    FROM loan_repayment_schedule
    WHERE loan_application_id = p_application_id
      AND org_id = p_org_id
  ),
  next_emi AS (
    SELECT row_to_json(t) AS data
    FROM (
      SELECT id, emi_number, due_date, total_emi, amount_paid, status
      FROM loan_repayment_schedule
      WHERE loan_application_id = p_application_id
        AND org_id = p_org_id
        AND status IN ('pending', 'overdue')
      ORDER BY due_date
      LIMIT 1
    ) t
  )
  SELECT json_build_object(
    'totalEMIs', c.total_emis,
    'paidEMIs', c.paid_emis,
    'pendingEMIs', c.pending_emis,
    'overdueEMIs', c.overdue_emis,
    'totalAmount', c.total_amount,
    'amountPaid', c.amount_paid,
    'balanceAmount', c.total_amount - c.amount_paid,
    'nextEMI', ne.data
  ) INTO result
  FROM counts c
  LEFT JOIN next_emi ne ON true;

  RETURN result;
END;
$$;
