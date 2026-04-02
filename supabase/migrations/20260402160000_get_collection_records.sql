-- RPC: get one collection row per loan (next due EMI or most recent overdue)
CREATE OR REPLACE FUNCTION get_collection_records(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result json;
BEGIN
  WITH next_due AS (
    -- For each loan, pick the oldest non-paid EMI (next actionable one)
    SELECT DISTINCT ON (rs.loan_application_id)
      rs.id AS schedule_id,
      rs.loan_application_id,
      rs.due_date,
      rs.total_emi,
      rs.principal_amount,
      rs.interest_amount,
      rs.amount_paid,
      rs.status
    FROM loan_repayment_schedule rs
    WHERE rs.org_id = p_org_id
      AND rs.status NOT IN ('paid', 'settled')
    ORDER BY rs.loan_application_id, rs.due_date ASC
  )
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.due_date ASC), '[]'::json)
  INTO result
  FROM (
    SELECT
      nd.schedule_id,
      nd.loan_application_id,
      nd.due_date,
      nd.total_emi,
      nd.principal_amount,
      nd.interest_amount,
      nd.amount_paid,
      nd.status,
      la.application_number,
      la.loan_id,
      la.interest_rate,
      la.tenure_days,
      la.contact_id,
      COALESCE(ld.disbursement_amount, la.requested_amount, 0) AS loan_amount,
      ld.disbursement_date,
      COALESCE(TRIM(ap.first_name || ' ' || COALESCE(ap.last_name, '')), 'N/A') AS applicant_name,
      COALESCE(ap.mobile, '') AS applicant_phone,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', lp.id,
          'transaction_reference', lp.transaction_reference,
          'payment_amount', lp.payment_amount,
          'payment_date', lp.payment_date,
          'payment_method', lp.payment_method
        ))
        FROM loan_payments lp
        WHERE lp.schedule_id = nd.schedule_id),
        '[]'::json
      ) AS payments
    FROM next_due nd
    JOIN loan_applications la ON la.id = nd.loan_application_id
    LEFT JOIN LATERAL (
      SELECT d.disbursement_amount, d.disbursement_date
      FROM loan_disbursements d
      WHERE d.loan_application_id = nd.loan_application_id
        AND d.status = 'completed'
      ORDER BY d.disbursement_date DESC
      LIMIT 1
    ) ld ON true
    LEFT JOIN LATERAL (
      SELECT a.first_name, a.last_name, a.mobile
      FROM loan_applicants a
      WHERE a.loan_application_id = nd.loan_application_id
      LIMIT 1
    ) ap ON true
  ) t;

  RETURN result;
END;
$$;
