-- Update loan_sanctions records with old 0.5% rate to 1%
UPDATE loan_sanctions
SET sanctioned_rate = 1
WHERE sanctioned_rate = 0.5;

-- Set default for sanctioned_rate column to 1%
ALTER TABLE loan_sanctions
ALTER COLUMN sanctioned_rate SET DEFAULT 1;

-- Sync loan_eligibility with sanctioned values (sanction is the final approved amount)
-- Only run if recommended_tenure_days column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'loan_eligibility'
      AND column_name = 'recommended_tenure_days'
  ) THEN
    EXECUTE '
      UPDATE loan_eligibility le
      SET
        eligible_loan_amount = ls.sanctioned_amount,
        recommended_tenure_days = ls.sanctioned_tenure_days,
        total_interest = ls.sanctioned_amount * (1.0 / 100) * ls.sanctioned_tenure_days,
        total_repayment = ls.sanctioned_amount + (ls.sanctioned_amount * (1.0 / 100) * ls.sanctioned_tenure_days),
        daily_emi = CEIL((ls.sanctioned_amount + (ls.sanctioned_amount * (1.0 / 100) * ls.sanctioned_tenure_days)) / ls.sanctioned_tenure_days)
      FROM loan_sanctions ls
      WHERE le.loan_application_id = ls.loan_application_id
        AND ls.sanctioned_amount IS NOT NULL
        AND ls.sanctioned_tenure_days IS NOT NULL
    ';
  END IF;
END $$;
