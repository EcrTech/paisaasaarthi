-- Phase 2: Normalize Loan Lifecycle Data
-- 2a: Sanction → loan_applications terms sync trigger
-- 2b: Auto-compute derived fields on loan_income_summaries
-- 2c: Add applicant_id FK to loan_disbursements
-- 2d: Add document_id FK to loan_sanctions

-- ============================================================
-- 2a: Auto-populate loan_applications terms from loan_sanctions
-- When a sanction is created/updated, sync key terms to the application
-- ============================================================

CREATE OR REPLACE FUNCTION sync_sanction_to_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE loan_applications
  SET
    approved_amount = COALESCE(NEW.sanctioned_amount, approved_amount),
    tenure_days = COALESCE(NEW.sanctioned_tenure_days, tenure_days),
    interest_rate = COALESCE(NEW.sanctioned_rate, interest_rate),
    updated_at = now()
  WHERE id = NEW.loan_application_id
    AND (
      approved_amount IS DISTINCT FROM COALESCE(NEW.sanctioned_amount, approved_amount)
      OR tenure_days IS DISTINCT FROM COALESCE(NEW.sanctioned_tenure_days, tenure_days)
      OR interest_rate IS DISTINCT FROM COALESCE(NEW.sanctioned_rate, interest_rate)
    );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_sanction_to_application
  AFTER INSERT OR UPDATE OF sanctioned_amount, sanctioned_tenure_days, sanctioned_rate
  ON loan_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION sync_sanction_to_application();

-- ============================================================
-- 2b: Auto-compute derived income fields on loan_income_summaries
-- Ensures average_monthly_income, annual_average_income,
-- income_growth_percentage, income_stability_score stay consistent
-- ============================================================

CREATE OR REPLACE FUNCTION compute_income_summary_derived()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_monthly numeric;
  v_annual_avg numeric;
  v_growth numeric;
  v_stability varchar(20);
BEGIN
  -- Compute average monthly income from salary data
  IF NEW.monthly_gross_salary IS NOT NULL AND NEW.monthly_gross_salary > 0 THEN
    v_avg_monthly := NEW.monthly_net_salary;
  END IF;

  -- Compute annual average from year 1/2 data
  IF NEW.year_1_gross_income IS NOT NULL AND NEW.year_2_gross_income IS NOT NULL THEN
    v_annual_avg := (NEW.year_1_gross_income + NEW.year_2_gross_income) / 2.0;

    -- Compute growth percentage
    IF NEW.year_1_gross_income > 0 THEN
      v_growth := ROUND(((NEW.year_2_gross_income - NEW.year_1_gross_income) / NEW.year_1_gross_income) * 100, 1);
    END IF;
  ELSIF NEW.year_2_gross_income IS NOT NULL THEN
    v_annual_avg := NEW.year_2_gross_income;
  ELSIF NEW.year_1_gross_income IS NOT NULL THEN
    v_annual_avg := NEW.year_1_gross_income;
  END IF;

  -- Derive monthly from annual if not set
  IF v_avg_monthly IS NULL AND v_annual_avg IS NOT NULL THEN
    v_avg_monthly := ROUND(v_annual_avg / 12.0, 2);
  END IF;

  -- Income stability score
  IF v_growth IS NOT NULL THEN
    IF v_growth >= 10 THEN v_stability := 'High';
    ELSIF v_growth >= 0 THEN v_stability := 'Medium';
    ELSE v_stability := 'Low';
    END IF;
  END IF;

  -- Apply computed values (only overwrite if we have data)
  NEW.average_monthly_income := COALESCE(v_avg_monthly, NEW.average_monthly_income);
  NEW.annual_average_income := COALESCE(v_annual_avg, NEW.annual_average_income);
  NEW.income_growth_percentage := COALESCE(v_growth, NEW.income_growth_percentage);
  NEW.income_stability_score := COALESCE(v_stability, NEW.income_stability_score);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_compute_income_derived
  BEFORE INSERT OR UPDATE ON loan_income_summaries
  FOR EACH ROW
  EXECUTE FUNCTION compute_income_summary_derived();

-- ============================================================
-- 2c: Add applicant_id FK to loan_disbursements
-- Allows direct join to loan_applicants without going through loan_applications
-- Bank detail columns retained (disbursement account may differ from verified account)
-- ============================================================

ALTER TABLE loan_disbursements
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES loan_applicants(id) ON DELETE SET NULL;

-- Backfill existing rows: set applicant_id from primary applicant
UPDATE loan_disbursements d
SET applicant_id = (
  SELECT la.id
  FROM loan_applicants la
  WHERE la.loan_application_id = d.loan_application_id
    AND la.applicant_type = 'primary'
  LIMIT 1
)
WHERE d.applicant_id IS NULL;

-- Auto-populate applicant_id on new disbursements
CREATE OR REPLACE FUNCTION auto_set_disbursement_applicant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.applicant_id IS NULL AND NEW.loan_application_id IS NOT NULL THEN
    SELECT id INTO NEW.applicant_id
    FROM loan_applicants
    WHERE loan_application_id = NEW.loan_application_id
      AND applicant_type = 'primary'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_set_disbursement_applicant
  BEFORE INSERT ON loan_disbursements
  FOR EACH ROW
  WHEN (NEW.applicant_id IS NULL)
  EXECUTE FUNCTION auto_set_disbursement_applicant();

-- ============================================================
-- 2d: Add document_id FK to loan_sanctions for sanction letter
-- Links sanction_letter_path to the canonical document record
-- ============================================================

ALTER TABLE loan_sanctions
  ADD COLUMN IF NOT EXISTS sanction_letter_document_id uuid REFERENCES loan_generated_documents(id) ON DELETE SET NULL;

-- Backfill: match existing sanction_letter_path to loan_generated_documents
UPDATE loan_sanctions s
SET sanction_letter_document_id = (
  SELECT d.id
  FROM loan_generated_documents d
  WHERE d.sanction_id = s.id
    AND d.document_type = 'sanction_letter'
  ORDER BY d.generated_at DESC
  LIMIT 1
)
WHERE s.sanction_letter_document_id IS NULL
  AND s.sanction_letter_path IS NOT NULL;
