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
BEGIN
  -- Atomic increment using UPDATE ... RETURNING
  UPDATE loan_repayment_schedule
  SET amount_paid = COALESCE(amount_paid, 0) + p_payment_amount,
      payment_date = CASE
        WHEN COALESCE(amount_paid, 0) + p_payment_amount >= total_emi THEN p_payment_date::DATE
        ELSE payment_date
      END
  WHERE id = p_schedule_id
  RETURNING total_emi, amount_paid INTO v_total_emi, v_new_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule item not found: %', p_schedule_id;
  END IF;

  -- Determine new status
  IF v_new_amount >= v_total_emi THEN
    v_new_status := 'paid';
  ELSIF v_new_amount > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- Update status
  UPDATE loan_repayment_schedule
  SET status = v_new_status
  WHERE id = p_schedule_id;

  new_amount_paid := v_new_amount;
  new_status := v_new_status;
  RETURN NEXT;
END;
$$;
