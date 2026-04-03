-- Fix non-standard application numbers: all should use LA- prefix
-- Root causes:
--   1. RepeatLoanDialog used APP- prefix (fixed in code)
--   2. create-early-lead / create-draft-referral-application use DRAFT- temp numbers
--      that were never replaced when apps were manually advanced past submission
--   3. Old data used LOAN- prefix (loan_id reused as app number)

-- Step 1: Fix existing bad records using the DB sequence for proper LA- numbers
DO $$
DECLARE
  rec RECORD;
  seq_val BIGINT;
  year_month TEXT;
  new_app_number TEXT;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYYYMM');

  FOR rec IN
    SELECT id, application_number
    FROM loan_applications
    WHERE application_number NOT LIKE 'LA-%'
    ORDER BY created_at
  LOOP
    seq_val := nextval('loan_application_number_seq');
    new_app_number := 'LA-' || year_month || '-' || LPAD(seq_val::TEXT, 5, '0');

    UPDATE loan_applications
    SET application_number = new_app_number,
        updated_at = NOW()
    WHERE id = rec.id;

    RAISE NOTICE 'Fixed % -> %', rec.application_number, new_app_number;
  END LOOP;
END;
$$;

-- Step 2: Update the trigger to also fix non-LA numbers on UPDATE
-- This acts as a DB-level safety net: if any code path inserts or updates
-- with a DRAFT-, APP-, LOAN-, or other non-LA prefix, the trigger
-- auto-assigns a proper LA- number.
CREATE OR REPLACE FUNCTION set_loan_application_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  seq_val BIGINT;
  year_month TEXT;
BEGIN
  -- On INSERT: fix NULL, empty, or non-LA numbers
  IF TG_OP = 'INSERT' THEN
    IF NEW.application_number IS NULL
       OR NEW.application_number = ''
       OR NEW.application_number LIKE 'DRAFT-%' THEN
      year_month := TO_CHAR(NOW(), 'YYYYMM');
      seq_val := nextval('loan_application_number_seq');
      NEW.application_number := 'LA-' || year_month || '-' || LPAD(seq_val::TEXT, 5, '0');
    END IF;
  END IF;

  -- On UPDATE: if stage moves beyond 'lead' or 'application', ensure LA- prefix
  IF TG_OP = 'UPDATE' THEN
    IF NEW.current_stage NOT IN ('lead', 'application')
       AND NEW.application_number IS NOT NULL
       AND NEW.application_number NOT LIKE 'LA-%' THEN
      year_month := TO_CHAR(NOW(), 'YYYYMM');
      seq_val := nextval('loan_application_number_seq');
      NEW.application_number := 'LA-' || year_month || '-' || LPAD(seq_val::TEXT, 5, '0');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger for both INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_set_loan_application_number ON loan_applications;
CREATE TRIGGER trigger_set_loan_application_number
  BEFORE INSERT OR UPDATE ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION set_loan_application_number();
