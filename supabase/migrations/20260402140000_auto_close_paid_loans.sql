-- Auto-close loan applications when all EMIs are fully paid
-- Previously, loans had to be manually closed even after full repayment

-- Update record_payment to auto-close the application when EMI is fully paid
CREATE OR REPLACE FUNCTION record_payment(
  p_schedule_id uuid,
  p_application_id uuid,
  p_org_id uuid,
  p_payment_date text,
  p_payment_amount numeric,
  p_principal_paid numeric,
  p_interest_paid numeric,
  p_late_fee_paid numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_transaction_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_number text;
  v_payment_id uuid;
  v_total_emi numeric;
  v_new_amount numeric;
  v_new_status text;
  v_principal numeric;
  v_interest_rate numeric;
  v_disbursement_date date;
  v_actual_days int;
  v_due_today numeric;
  v_all_paid boolean;
BEGIN
  -- Generate payment number
  v_payment_number := 'PMT' || EXTRACT(EPOCH FROM now())::bigint::text;

  -- 1. Insert payment record
  INSERT INTO loan_payments (
    loan_application_id, schedule_id, org_id, payment_number,
    payment_date, payment_amount, principal_paid, interest_paid,
    late_fee_paid, payment_method, transaction_reference, notes, created_by
  ) VALUES (
    p_application_id, p_schedule_id, p_org_id, v_payment_number,
    p_payment_date::date, p_payment_amount, p_principal_paid, p_interest_paid,
    p_late_fee_paid, p_payment_method, p_transaction_reference, p_notes, p_created_by
  )
  RETURNING id INTO v_payment_id;

  -- 2. Atomic schedule update
  UPDATE loan_repayment_schedule
  SET amount_paid = COALESCE(amount_paid, 0) + p_payment_amount,
      payment_date = CASE
        WHEN COALESCE(amount_paid, 0) + p_payment_amount >= total_emi THEN p_payment_date::date
        ELSE payment_date
      END
  WHERE id = p_schedule_id
  RETURNING total_emi, amount_paid, principal_amount
  INTO v_total_emi, v_new_amount, v_principal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule item not found: %', p_schedule_id;
  END IF;

  -- 3. Calculate due-today for accurate status
  SELECT la.interest_rate, ld.disbursement_date
  INTO v_interest_rate, v_disbursement_date
  FROM loan_applications la
  LEFT JOIN loan_disbursements ld ON ld.loan_application_id = la.id
  WHERE la.id = p_application_id
  LIMIT 1;

  IF v_interest_rate IS NOT NULL AND v_disbursement_date IS NOT NULL THEN
    v_actual_days := GREATEST(1, (p_payment_date::date - v_disbursement_date));
    v_due_today := v_principal + ROUND(v_principal * (v_interest_rate / 100) * v_actual_days);
  ELSE
    v_due_today := v_total_emi;
  END IF;

  IF v_new_amount >= v_due_today OR v_new_amount >= v_total_emi THEN
    v_new_status := 'paid';
  ELSIF v_new_amount > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- 4. Final status update on schedule
  UPDATE loan_repayment_schedule
  SET status = v_new_status,
      payment_date = CASE WHEN v_new_status = 'paid' THEN p_payment_date::date ELSE payment_date END
  WHERE id = p_schedule_id;

  -- 5. Auto-close: if all EMIs for this application are now paid, close the loan
  IF v_new_status = 'paid' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM loan_repayment_schedule
      WHERE loan_application_id = p_application_id
        AND status NOT IN ('paid', 'settled')
    ) INTO v_all_paid;

    IF v_all_paid THEN
      UPDATE loan_applications
      SET status = 'closed',
          current_stage = 'closed',
          updated_at = now()
      WHERE id = p_application_id
        AND status != 'closed';
    END IF;
  END IF;

  RETURN json_build_object(
    'paymentId', v_payment_id,
    'paymentNumber', v_payment_number,
    'newAmountPaid', v_new_amount,
    'newStatus', v_new_status,
    'loanClosed', COALESCE(v_all_paid, false)
  );
END;
$$;
