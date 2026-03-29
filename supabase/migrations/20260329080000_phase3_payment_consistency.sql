-- Phase 3: Fix Payment & Status Consistency
-- 3a: Atomic record_payment RPC (combines loan_payments insert + schedule update)
-- 3b: Status derivation already handled by record_emi_payment_atomic; no change needed
-- 3c: Derive bank_verified from loan_verifications via trigger

-- ============================================================
-- 3a: Unified record_payment RPC — single transaction for both
-- loan_payments insert AND loan_repayment_schedule update
-- Replaces the 2-step frontend flow that could leave orphaned records
-- ============================================================

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

  -- 2. Atomic schedule update (same logic as record_emi_payment_atomic)
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

  -- 4. Final status update
  UPDATE loan_repayment_schedule
  SET status = v_new_status,
      payment_date = CASE WHEN v_new_status = 'paid' THEN p_payment_date::date ELSE payment_date END
  WHERE id = p_schedule_id;

  RETURN json_build_object(
    'paymentId', v_payment_id,
    'paymentNumber', v_payment_number,
    'newAmountPaid', v_new_amount,
    'newStatus', v_new_status
  );
END;
$$;

-- ============================================================
-- 3c: Auto-sync bank_verified from loan_verifications
-- When a bank_account verification succeeds, set bank_verified on applicant
-- ============================================================

CREATE OR REPLACE FUNCTION sync_bank_verified_from_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'success'
    AND NEW.verification_type IN ('bank_account', 'bank_manual')
    AND NEW.loan_application_id IS NOT NULL
  THEN
    UPDATE loan_applicants
    SET
      bank_verified = true,
      bank_verified_at = COALESCE(NEW.verified_at, now()),
      bank_verification_method = CASE
        WHEN NEW.verification_type = 'bank_account' THEN 'api'
        WHEN NEW.verification_type = 'bank_manual' THEN 'manual'
        ELSE NEW.verification_source
      END,
      updated_at = now()
    WHERE loan_application_id = NEW.loan_application_id
      AND applicant_type = 'primary'
      AND (bank_verified IS NOT TRUE);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_bank_verified
  AFTER INSERT OR UPDATE OF status ON loan_verifications
  FOR EACH ROW
  WHEN (NEW.status = 'success' AND NEW.verification_type IN ('bank_account', 'bank_manual'))
  EXECUTE FUNCTION sync_bank_verified_from_verification();
