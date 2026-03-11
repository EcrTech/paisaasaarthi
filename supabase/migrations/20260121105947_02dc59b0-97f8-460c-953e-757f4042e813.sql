-- Update loan_eligibility records with old 0.5% rate to 1%
UPDATE loan_eligibility
SET recommended_interest_rate = 1
WHERE recommended_interest_rate = 0.5;

-- Recalculate stored values for all records that now have 1% rate
-- Only run if recommended_tenure_days column exists (may have been added outside migrations)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'loan_eligibility'
      AND column_name = 'recommended_tenure_days'
  ) THEN
    EXECUTE '
      UPDATE loan_eligibility
      SET
        total_interest = eligible_loan_amount * (1.0 / 100) * recommended_tenure_days,
        total_repayment = eligible_loan_amount + (eligible_loan_amount * (1.0 / 100) * recommended_tenure_days),
        daily_emi = CEIL((eligible_loan_amount + (eligible_loan_amount * (1.0 / 100) * recommended_tenure_days)) / recommended_tenure_days)
      WHERE recommended_interest_rate = 1
        AND eligible_loan_amount IS NOT NULL
        AND recommended_tenure_days IS NOT NULL
    ';
  END IF;
END $$;

-- Set default for recommended_interest_rate column to 1%
ALTER TABLE loan_eligibility
ALTER COLUMN recommended_interest_rate SET DEFAULT 1;
