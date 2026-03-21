-- Fix payment status: compare against due-today (principal + interest based on actual days)
-- instead of total_emi (which is based on full tenure days at schedule creation time).
-- Business logic: if amount_paid covers the due-today amount, status should be 'paid'.

CREATE OR REPLACE FUNCTION public.record_emi_payment_atomic(
  p_schedule_id UUID,
  p_payment_amount NUMERIC,
  p_payment_date TEXT
)
RETURNS TABLE(new_amount_paid NUMERIC, new_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_emi NUMERIC;
  v_new_amount NUMERIC;
  v_new_status TEXT;
  v_principal NUMERIC;
  v_interest_rate NUMERIC;
  v_disbursement_date DATE;
  v_actual_days INT;
  v_due_today NUMERIC;
  v_app_id UUID;
BEGIN
  -- Atomic increment using UPDATE ... RETURNING
  UPDATE loan_repayment_schedule
  SET amount_paid = COALESCE(amount_paid, 0) + p_payment_amount,
      payment_date = CASE
        WHEN COALESCE(amount_paid, 0) + p_payment_amount >= total_emi THEN p_payment_date::DATE
        ELSE payment_date
      END
  WHERE id = p_schedule_id
  RETURNING total_emi, amount_paid, principal_amount, loan_application_id
  INTO v_total_emi, v_new_amount, v_principal, v_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule item not found: %', p_schedule_id;
  END IF;

  -- Look up interest_rate and disbursement_date to calculate due-today
  SELECT la.interest_rate, ld.disbursement_date
  INTO v_interest_rate, v_disbursement_date
  FROM loan_applications la
  LEFT JOIN loan_disbursements ld ON ld.loan_application_id = la.id
  WHERE la.id = v_app_id
  LIMIT 1;

  -- Calculate due-today: principal + principal * rate% * actual_days
  IF v_interest_rate IS NOT NULL AND v_disbursement_date IS NOT NULL THEN
    v_actual_days := GREATEST(1, (p_payment_date::DATE - v_disbursement_date));
    v_due_today := v_principal + ROUND(v_principal * (v_interest_rate / 100) * v_actual_days);
  ELSE
    v_due_today := v_total_emi;
  END IF;

  -- Determine new status: paid if amount covers either due-today or total_emi
  IF v_new_amount >= v_due_today OR v_new_amount >= v_total_emi THEN
    v_new_status := 'paid';
  ELSIF v_new_amount > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- Update status and payment_date if paid
  UPDATE loan_repayment_schedule
  SET status = v_new_status,
      payment_date = CASE WHEN v_new_status = 'paid' THEN p_payment_date::DATE ELSE payment_date END
  WHERE id = p_schedule_id;

  new_amount_paid := v_new_amount;
  new_status := v_new_status;
  RETURN NEXT;
END;
$$;
