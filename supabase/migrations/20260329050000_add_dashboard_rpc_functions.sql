-- RPC functions to replace client-side aggregation on the LOS Dashboard
-- This eliminates fetching thousands of rows to the browser and processing them in JS

-- 1. get_los_dashboard_stats: replaces 5 parallel queries + client-side dedup/aggregation
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
        WHEN 'closed' THEN 7
        WHEN 'disbursed' THEN 6
        WHEN 'disbursement_pending' THEN 5
        WHEN 'sanctioned' THEN 5
        WHEN 'approval_pending' THEN 4
        WHEN 'credit_assessment' THEN 3
        WHEN 'field_verification' THEN 3
        WHEN 'document_collection' THEN 3
        WHEN 'application_login' THEN 3
        ELSE 1
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
      COUNT(*) FILTER (WHERE max_priority >= 6)::int AS disbursed,
      COUNT(*) FILTER (WHERE max_priority IN (4, 5))::int AS pending_approval,
      COUNT(*) FILTER (WHERE max_priority = 3)::int AS in_progress
    FROM stage_priority
  ),
  sanctioned AS (
    SELECT COALESCE(SUM(approved_amount), 0)::bigint AS total_sanctioned
    FROM loan_applications
    WHERE org_id = p_org_id
      AND approved_amount IS NOT NULL
      AND status IN ('approved', 'disbursed', 'closed')
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
    'disbursed', cc.disbursed,
    'pendingApproval', cc.pending_approval,
    'inProgress', cc.in_progress,
    'totalSanctioned', s.total_sanctioned,
    'totalDisbursedAmount', da.total_disbursed,
    'pendingEMIs', e.pending_emis,
    'overdueEMIs', e.overdue_emis
  ) INTO result
  FROM contact_cards cc, sanctioned s, disbursed_amt da, emi_counts e;

  RETURN result;
END;
$$;

-- 2. get_stage_distribution: replaces fetching all apps and client-side GROUP BY
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
        WHEN 'application_login' THEN 1
        WHEN 'document_collection' THEN 2
        WHEN 'field_verification' THEN 3
        WHEN 'credit_assessment' THEN 4
        WHEN 'approval_pending' THEN 5
        WHEN 'sanctioned' THEN 6
        WHEN 'rejected' THEN 7
        WHEN 'disbursement_pending' THEN 8
        WHEN 'disbursed' THEN 9
        WHEN 'closed' THEN 10
        ELSE 99
      END AS sort_order
    FROM loan_applications
    WHERE org_id = p_org_id AND status != 'draft'
    GROUP BY current_stage
  ) t;

  RETURN result;
END;
$$;

-- 3. get_disbursement_trend: replaces fetching all disbursements and client-side date bucketing
CREATE OR REPLACE FUNCTION get_disbursement_trend(p_org_id uuid, p_daily boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
  range_start date;
BEGIN
  IF p_daily THEN
    range_start := date_trunc('month', CURRENT_DATE)::date;
  ELSE
    range_start := (date_trunc('month', CURRENT_DATE) - interval '6 months')::date;
  END IF;

  IF p_daily THEN
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.day), '[]'::json)
    INTO result
    FROM (
      SELECT
        gs.day,
        to_char(gs.day, 'DD') AS label,
        COALESCE(SUM(d.disbursement_amount), 0)::bigint AS amount,
        COUNT(d.id)::int AS count
      FROM generate_series(range_start, CURRENT_DATE, '1 day'::interval) gs(day)
      LEFT JOIN loan_disbursements d
        ON d.disbursement_date = gs.day::date
        AND d.status = 'completed'
        AND d.loan_application_id IN (SELECT id FROM loan_applications WHERE org_id = p_org_id)
      GROUP BY gs.day
    ) t;
  ELSE
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.month_start), '[]'::json)
    INTO result
    FROM (
      SELECT
        gs.month_start,
        to_char(gs.month_start, 'Mon') AS label,
        COALESCE(SUM(d.disbursement_amount), 0)::bigint AS amount,
        COUNT(d.id)::int AS count
      FROM generate_series(range_start, date_trunc('month', CURRENT_DATE)::date, '1 month'::interval) gs(month_start)
      LEFT JOIN loan_disbursements d
        ON date_trunc('month', d.disbursement_date) = gs.month_start
        AND d.status = 'completed'
        AND d.loan_application_id IN (SELECT id FROM loan_applications WHERE org_id = p_org_id)
      GROUP BY gs.month_start
    ) t;
  END IF;

  RETURN result;
END;
$$;

-- 4. get_leads_by_source_trend: replaces fetching all apps and client-side source+date bucketing
CREATE OR REPLACE FUNCTION get_leads_by_source_trend(p_org_id uuid, p_daily boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
  range_start date;
BEGIN
  IF p_daily THEN
    range_start := date_trunc('month', CURRENT_DATE)::date;
  ELSE
    range_start := date_trunc('month', CURRENT_DATE - interval '5 months')::date;
  END IF;

  SELECT json_build_object(
    'sources', COALESCE((
      SELECT json_agg(DISTINCT COALESCE(source, 'unknown'))
      FROM loan_applications
      WHERE org_id = p_org_id AND status != 'draft' AND created_at >= range_start
    ), '[]'::json),
    'data', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.bucket)
      FROM (
        SELECT
          CASE WHEN p_daily
            THEN to_char(created_at::date, 'DD')
            ELSE to_char(date_trunc('month', created_at), 'Mon')
          END AS label,
          CASE WHEN p_daily
            THEN created_at::date::text
            ELSE date_trunc('month', created_at)::date::text
          END AS bucket,
          COALESCE(source, 'unknown') AS source,
          COUNT(*)::int AS count
        FROM loan_applications
        WHERE org_id = p_org_id AND status != 'draft' AND created_at >= range_start
        GROUP BY bucket, label, source
      ) t
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- 5. get_cashflow_data: replaces 70+ lines of client-side EMI processing
CREATE OR REPLACE FUNCTION get_cashflow_data(p_org_id uuid, p_daily boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
  range_start date;
  range_end date;
  today date := CURRENT_DATE;
BEGIN
  IF p_daily THEN
    range_start := date_trunc('month', today)::date;
    range_end := (date_trunc('month', today) + interval '1 month' - interval '1 day')::date;
  ELSE
    range_start := date_trunc('month', today - interval '5 months')::date;
    range_end := (date_trunc('month', today + interval '6 months') + interval '1 month' - interval '1 day')::date;
  END IF;

  WITH emi_data AS (
    SELECT due_date, total_emi, amount_paid, status
    FROM loan_repayment_schedule
    WHERE org_id = p_org_id
      AND due_date BETWEEN range_start AND range_end
  ),
  chart AS (
    SELECT
      CASE WHEN p_daily
        THEN to_char(gs.bucket, 'DD')
        ELSE to_char(gs.bucket, 'Mon')
      END AS label,
      CASE WHEN p_daily
        THEN to_char(gs.bucket, 'DD Mon')
        ELSE to_char(gs.bucket, 'Mon YYYY')
      END AS "fullLabel",
      COALESCE(SUM(e.total_emi), 0)::bigint AS expected,
      CASE WHEN (p_daily AND gs.bucket::date <= today) OR (NOT p_daily AND gs.bucket <= date_trunc('month', today))
        THEN COALESCE(SUM(e.amount_paid), 0)::bigint
        ELSE NULL
      END AS collected,
      CASE WHEN (p_daily AND gs.bucket::date > today) OR (NOT p_daily AND NOT (gs.bucket <= date_trunc('month', today)))
        THEN COALESCE(SUM(e.total_emi), 0)::bigint
        WHEN (p_daily AND gs.bucket::date = today) OR (NOT p_daily AND to_char(gs.bucket, 'YYYY-MM') = to_char(today, 'YYYY-MM'))
        THEN COALESCE(SUM(e.total_emi), 0)::bigint
        ELSE NULL
      END AS projected,
      CASE WHEN (p_daily AND gs.bucket::date <= today) OR (NOT p_daily AND (gs.bucket <= date_trunc('month', today) OR to_char(gs.bucket, 'YYYY-MM') = to_char(today, 'YYYY-MM')))
        THEN COALESCE(SUM(CASE WHEN e.status = 'overdue' OR (e.status = 'pending' AND e.due_date < today) THEN e.total_emi - e.amount_paid ELSE 0 END), 0)::bigint
        ELSE NULL
      END AS overdue
    FROM generate_series(
      range_start,
      range_end,
      CASE WHEN p_daily THEN '1 day'::interval ELSE '1 month'::interval END
    ) gs(bucket)
    LEFT JOIN emi_data e ON (
      CASE WHEN p_daily
        THEN e.due_date = gs.bucket::date
        ELSE date_trunc('month', e.due_date) = gs.bucket
      END
    )
    GROUP BY gs.bucket
    ORDER BY gs.bucket
  ),
  summary AS (
    SELECT
      COALESCE(SUM(total_emi) FILTER (WHERE due_date <= today), 0)::bigint AS "totalExpected",
      COALESCE(SUM(amount_paid) FILTER (WHERE due_date <= today), 0)::bigint AS "totalCollected",
      COALESCE(SUM(total_emi - amount_paid) FILTER (WHERE status = 'overdue' OR (status = 'pending' AND due_date < today)), 0)::bigint AS "totalOverdue",
      COALESCE(SUM(total_emi) FILTER (WHERE due_date > today AND due_date <= today + interval '3 months'), 0)::bigint AS "next3MonthsProjected"
    FROM emi_data
  )
  SELECT json_build_object(
    'chartData', COALESCE((SELECT json_agg(row_to_json(c)) FROM chart c), '[]'::json),
    'summary', (
      SELECT json_build_object(
        'totalExpected', s."totalExpected",
        'totalCollected', s."totalCollected",
        'totalOverdue', s."totalOverdue",
        'next3MonthsProjected', s."next3MonthsProjected",
        'collectionRate', CASE WHEN s."totalExpected" > 0 THEN ROUND((s."totalCollected"::numeric / s."totalExpected") * 100) ELSE 0 END
      )
      FROM summary s
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 6. get_emi_stats: combines 5 sequential queries from useEMIStats into one
CREATE OR REPLACE FUNCTION get_emi_stats(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
  today date := CURRENT_DATE;
  future_date date := today + 30;
BEGIN
  WITH counts AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_emis,
      COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'pending' AND due_date < today))::int AS overdue_emis,
      COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_emis,
      COALESCE(SUM(total_emi), 0)::bigint AS total_expected,
      COALESCE(SUM(amount_paid), 0)::bigint AS total_collected
    FROM loan_repayment_schedule
    WHERE org_id = p_org_id
  ),
  upcoming AS (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.due_date), '[]'::json) AS data
    FROM (
      SELECT
        s.id,
        s.due_date,
        s.total_emi,
        s.amount_paid,
        s.status,
        a.application_number,
        COALESCE(ap.first_name || ' ' || ap.last_name, '') AS applicant_name
      FROM loan_repayment_schedule s
      JOIN loan_applications a ON s.loan_application_id = a.id
      LEFT JOIN loan_applicants ap ON a.id = ap.loan_application_id AND ap.applicant_type = 'primary'
      WHERE s.org_id = p_org_id
        AND s.status IN ('pending', 'overdue')
        AND s.due_date BETWEEN today AND future_date
      ORDER BY s.due_date
      LIMIT 10
    ) t
  )
  SELECT json_build_object(
    'pendingEMIs', c.pending_emis,
    'overdueEMIs', c.overdue_emis,
    'paidEMIs', c.paid_emis,
    'totalExpected', c.total_expected,
    'totalCollected', c.total_collected,
    'collectionRate', CASE WHEN c.total_expected > 0 THEN ROUND((c.total_collected::numeric / c.total_expected) * 100, 1) ELSE 0 END,
    'upcomingEMIs', u.data
  ) INTO result
  FROM counts c, upcoming u;

  RETURN result;
END;
$$;
