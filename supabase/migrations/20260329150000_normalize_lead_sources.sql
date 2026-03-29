-- Fix dirty source values in loan_applications where full UTM strings were stored
-- e.g. 'Google-Ads&Utm Medium=Cpc&Utm Campaignid=...' → 'Google Ads'

-- 1. Clean up existing dirty data: strip everything after '&' for UTM-contaminated sources
UPDATE loan_applications
SET source = split_part(source, '&', 1)
WHERE source LIKE '%&%';

-- 2. Normalize common Google Ads variants
UPDATE loan_applications
SET source = 'Google Ads'
WHERE lower(source) IN ('google-ads', 'google ads', 'google');

-- 3. Normalize common Meta/Facebook variants
UPDATE loan_applications
SET source = 'Meta Ads'
WHERE lower(source) IN ('facebook', 'fb', 'meta');

-- 4. Update the RPC function to normalize sources going forward
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
      SELECT json_agg(DISTINCT norm_source)
      FROM (
        SELECT
          CASE
            WHEN source IS NULL THEN 'unknown'
            WHEN lower(split_part(source, '&', 1)) IN ('google', 'google-ads', 'google ads') THEN 'Google Ads'
            WHEN lower(split_part(source, '&', 1)) IN ('facebook', 'fb', 'meta') THEN 'Meta Ads'
            ELSE split_part(source, '&', 1)
          END AS norm_source
        FROM loan_applications
        WHERE org_id = p_org_id AND status != 'draft' AND created_at >= range_start
      ) sub
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
          CASE
            WHEN source IS NULL THEN 'unknown'
            WHEN lower(split_part(source, '&', 1)) IN ('google', 'google-ads', 'google ads') THEN 'Google Ads'
            WHEN lower(split_part(source, '&', 1)) IN ('facebook', 'fb', 'meta') THEN 'Meta Ads'
            ELSE split_part(source, '&', 1)
          END AS source,
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
