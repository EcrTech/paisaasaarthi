-- Improve cash flow dashboard: weekly bucketing + outstanding metric
-- Replaces daily-only view with daily/weekly/monthly support
-- Adds totalOutstanding = totalExpected - totalCollected to make the math clear

DROP FUNCTION IF EXISTS get_cashflow_data(uuid, boolean);

CREATE OR REPLACE FUNCTION get_cashflow_data(p_org_id uuid, p_interval text DEFAULT 'weekly')
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
  IF p_interval = 'monthly' THEN
    range_start := date_trunc('month', today - interval '5 months')::date;
    range_end   := (date_trunc('month', today + interval '6 months') + interval '1 month' - interval '1 day')::date;
  ELSE
    -- daily and weekly both use current month
    range_start := date_trunc('month', today)::date;
    range_end   := (date_trunc('month', today) + interval '1 month' - interval '1 day')::date;
  END IF;

  WITH emi_data AS (
    SELECT due_date, total_emi, amount_paid, status
    FROM loan_repayment_schedule
    WHERE org_id = p_org_id
      AND due_date BETWEEN range_start AND range_end
  ),
  chart AS (
    SELECT
      CASE
        WHEN p_interval = 'daily' THEN to_char(gs.bucket, 'DD')
        WHEN p_interval = 'weekly' THEN
          EXTRACT(day FROM gs.bucket)::int::text || '-' ||
          LEAST(EXTRACT(day FROM gs.bucket)::int + 6,
                EXTRACT(day FROM range_end)::int)::text
        ELSE to_char(gs.bucket, 'Mon')
      END AS label,
      CASE
        WHEN p_interval = 'daily' THEN to_char(gs.bucket, 'DD Mon')
        WHEN p_interval = 'weekly' THEN
          to_char(gs.bucket, 'DD Mon') || ' - ' ||
          to_char(LEAST(gs.bucket::date + 6, range_end), 'DD Mon')
        ELSE to_char(gs.bucket, 'Mon YYYY')
      END AS "fullLabel",
      COALESCE(SUM(e.total_emi), 0)::bigint AS expected,

      -- collected: show for buckets whose start <= today
      CASE
        WHEN p_interval = 'monthly' AND gs.bucket <= date_trunc('month', today)
          THEN COALESCE(SUM(e.amount_paid), 0)::bigint
        WHEN p_interval IN ('daily','weekly') AND gs.bucket::date <= today
          THEN COALESCE(SUM(e.amount_paid) FILTER (WHERE e.due_date <= today), 0)::bigint
        ELSE NULL
      END AS collected,

      -- projected: show for buckets containing today or future
      CASE
        WHEN p_interval = 'monthly' AND gs.bucket >= date_trunc('month', today)
          THEN COALESCE(SUM(e.total_emi), 0)::bigint
        WHEN p_interval = 'daily' AND gs.bucket::date >= today
          THEN COALESCE(SUM(e.total_emi), 0)::bigint
        WHEN p_interval = 'weekly' AND (gs.bucket::date + 6) >= today
          THEN COALESCE(SUM(e.total_emi) FILTER (WHERE e.due_date >= today), 0)::bigint
        ELSE NULL
      END AS projected,

      -- overdue: show for buckets whose start <= today
      CASE
        WHEN p_interval = 'monthly' AND (gs.bucket <= date_trunc('month', today)
             OR to_char(gs.bucket, 'YYYY-MM') = to_char(today, 'YYYY-MM'))
          THEN COALESCE(SUM(
            CASE WHEN e.status = 'overdue' OR (e.status = 'pending' AND e.due_date < today)
              THEN e.total_emi - e.amount_paid ELSE 0
            END), 0)::bigint
        WHEN p_interval IN ('daily','weekly') AND gs.bucket::date <= today
          THEN COALESCE(SUM(
            CASE WHEN e.status = 'overdue' OR (e.status = 'pending' AND e.due_date < today)
              THEN e.total_emi - e.amount_paid ELSE 0
            END
          ) FILTER (WHERE e.due_date <= today), 0)::bigint
        ELSE NULL
      END AS overdue

    FROM generate_series(
      range_start,
      range_end,
      CASE
        WHEN p_interval = 'daily'  THEN '1 day'::interval
        WHEN p_interval = 'weekly' THEN '7 days'::interval
        ELSE '1 month'::interval
      END
    ) gs(bucket)
    LEFT JOIN emi_data e ON (
      CASE
        WHEN p_interval = 'daily'  THEN e.due_date = gs.bucket::date
        WHEN p_interval = 'weekly' THEN e.due_date >= gs.bucket::date
                                        AND e.due_date < (gs.bucket + '7 days'::interval)::date
        ELSE date_trunc('month', e.due_date) = gs.bucket
      END
    )
    GROUP BY gs.bucket
    ORDER BY gs.bucket
  ),
  summary AS (
    SELECT
      COALESCE(SUM(total_emi) FILTER (WHERE due_date <= today), 0)::bigint
        AS "totalExpected",
      COALESCE(SUM(amount_paid) FILTER (WHERE due_date <= today), 0)::bigint
        AS "totalCollected",
      COALESCE(SUM(total_emi - amount_paid) FILTER (
        WHERE status = 'overdue' OR (status = 'pending' AND due_date < today)
      ), 0)::bigint AS "totalOverdue",
      COALESCE(SUM(total_emi) FILTER (
        WHERE due_date > today AND due_date <= today + interval '3 months'
      ), 0)::bigint AS "next3MonthsProjected",
      -- Outstanding = total unpaid from EMIs due to date
      GREATEST(
        COALESCE(SUM(total_emi) FILTER (WHERE due_date <= today), 0) -
        COALESCE(SUM(amount_paid) FILTER (WHERE due_date <= today), 0),
        0
      )::bigint AS "totalOutstanding"
    FROM emi_data
  )
  SELECT json_build_object(
    'chartData', COALESCE((
      SELECT json_agg(json_build_object(
        'label',     c.label,
        'fullLabel', c."fullLabel",
        'expected',  c.expected,
        'collected', c.collected,
        'projected', c.projected,
        'overdue',   c.overdue
      ))
      FROM chart c
    ), '[]'::json),
    'summary', (
      SELECT json_build_object(
        'totalExpected',       s."totalExpected",
        'totalCollected',      s."totalCollected",
        'totalOverdue',        s."totalOverdue",
        'totalOutstanding',    s."totalOutstanding",
        'next3MonthsProjected',s."next3MonthsProjected",
        'collectionRate',      CASE WHEN s."totalExpected" > 0
          THEN ROUND((s."totalCollected"::numeric / s."totalExpected") * 100)
          ELSE 0
        END
      )
      FROM summary s
    )
  ) INTO result;

  RETURN result;
END;
$$;
