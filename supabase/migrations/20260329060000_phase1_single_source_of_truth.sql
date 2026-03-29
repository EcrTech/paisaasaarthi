-- Phase 1: Single Source of Truth — Eliminate Critical Data Duplication
-- 1a: Phone sync trigger (email sync already exists)
-- 1b: (skip — trigger_sync_primary_email already handles this)
-- 1c: Primary applicant → contact sync
-- 1d: Drop loan_applicants.age (always computed from dob)
-- 1e: Verification enrichment trigger (replaces edge-function backfill)

-- ============================================================
-- 1a: Sync contacts.phone from contact_phones when primary changes
-- Mirrors existing sync_primary_email_to_contact() pattern
-- ============================================================

CREATE OR REPLACE FUNCTION sync_primary_phone_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If a primary phone is being set
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.is_primary = true THEN
      -- Update the contact's phone field
      UPDATE contacts
      SET phone = NEW.phone, updated_at = now()
      WHERE id = NEW.contact_id AND org_id = NEW.org_id;

      -- Unset any other primary phones for this contact
      UPDATE contact_phones
      SET is_primary = false
      WHERE contact_id = NEW.contact_id
        AND org_id = NEW.org_id
        AND id != NEW.id
        AND is_primary = true;
    END IF;
  END IF;

  -- If a primary phone is being deleted, clear the contact's phone
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_primary = true THEN
      UPDATE contacts
      SET phone = NULL, updated_at = now()
      WHERE id = OLD.contact_id AND org_id = OLD.org_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_sync_primary_phone
  AFTER INSERT OR DELETE OR UPDATE ON contact_phones
  FOR EACH ROW
  EXECUTE FUNCTION sync_primary_phone_to_contact();

-- ============================================================
-- 1c: Sync primary loan_applicant changes → linked contact
-- One-way only (applicant → contact) to protect loan data integrity
-- ============================================================

CREATE OR REPLACE FUNCTION sync_applicant_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  -- Only trigger for primary applicants; prevent infinite loops
  IF NEW.applicant_type != 'primary' OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Find linked contact via loan_applications
  SELECT contact_id INTO v_contact_id
  FROM loan_applications
  WHERE id = NEW.loan_application_id;

  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sync changed fields (only overwrite if new value is not null)
  UPDATE contacts
  SET
    first_name = COALESCE(NEW.first_name, first_name),
    last_name  = COALESCE(NEW.last_name, last_name),
    phone      = COALESCE(NEW.mobile, phone),
    email      = COALESCE(NEW.email, email),
    updated_at = now()
  WHERE id = v_contact_id
    AND (
      first_name IS DISTINCT FROM COALESCE(NEW.first_name, first_name)
      OR last_name IS DISTINCT FROM COALESCE(NEW.last_name, last_name)
      OR phone IS DISTINCT FROM COALESCE(NEW.mobile, phone)
      OR email IS DISTINCT FROM COALESCE(NEW.email, email)
    );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_applicant_to_contact
  AFTER UPDATE ON loan_applicants
  FOR EACH ROW
  WHEN (
    OLD.first_name IS DISTINCT FROM NEW.first_name
    OR OLD.last_name IS DISTINCT FROM NEW.last_name
    OR OLD.mobile IS DISTINCT FROM NEW.mobile
    OR OLD.email IS DISTINCT FROM NEW.email
  )
  EXECUTE FUNCTION sync_applicant_to_contact();

-- ============================================================
-- 1d: Drop loan_applicants.age — always computed from dob
-- EligibilityCalculator already computes age from dob inline
-- ============================================================

ALTER TABLE loan_applicants DROP COLUMN IF EXISTS age;

-- ============================================================
-- 1e: Verification enrichment trigger
-- Moves dob/gender/address backfill from edge functions to DB
-- Single place that enriches loan_applicants from verification data
-- ============================================================

CREATE OR REPLACE FUNCTION enrich_applicant_from_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response jsonb;
  v_dob text;
  v_gender text;
  v_addr_obj jsonb;
  v_address jsonb;
BEGIN
  -- Only run for successful verifications linked to an application
  IF NEW.status != 'success' OR NEW.loan_application_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if already was success (avoid re-enrichment on unrelated updates)
  IF TG_OP = 'UPDATE' AND OLD.status = 'success' THEN
    RETURN NEW;
  END IF;

  v_response := NEW.response_data::jsonb;

  IF NEW.verification_type = 'aadhaar' THEN
    -- Extract DOB
    v_dob := NULLIF(v_response->>'dob', '');

    -- Extract gender
    v_gender := NULLIF(v_response->>'gender', '');

    -- Extract structured address
    v_addr_obj := v_response->'addresses'->0;
    IF v_addr_obj IS NULL THEN
      v_addr_obj := v_response->'split_address';
    END IF;

    IF v_addr_obj IS NOT NULL AND jsonb_typeof(v_addr_obj) = 'object' THEN
      v_address := jsonb_build_object(
        'line1', COALESCE(concat_ws(', ',
          NULLIF(v_addr_obj->>'house', ''),
          NULLIF(v_addr_obj->>'street', ''),
          NULLIF(v_addr_obj->>'landmark', '')
        ), ''),
        'line2', COALESCE(concat_ws(', ',
          NULLIF(COALESCE(v_addr_obj->>'loc', v_addr_obj->>'locality'), ''),
          NULLIF(v_addr_obj->>'vtc', ''),
          NULLIF(v_addr_obj->>'subdist', '')
        ), ''),
        'city', COALESCE(v_addr_obj->>'dist', ''),
        'state', COALESCE(v_addr_obj->>'state', ''),
        'pincode', COALESCE(
          NULLIF(v_addr_obj->>'pc', ''),
          NULLIF(v_addr_obj->>'pincode', ''),
          NULLIF(v_addr_obj->>'zip', ''),
          ''
        )
      );
    ELSIF NULLIF(v_response->>'verified_address', '') IS NOT NULL THEN
      v_address := jsonb_build_object(
        'line1', v_response->>'verified_address',
        'line2', '', 'city', '', 'state', '', 'pincode', ''
      );
    END IF;

    -- Apply updates to primary applicant
    UPDATE loan_applicants
    SET
      dob = COALESCE(v_dob, dob),
      gender = COALESCE(v_gender, gender),
      current_address = COALESCE(v_address, current_address),
      updated_at = now()
    WHERE loan_application_id = NEW.loan_application_id
      AND applicant_type = 'primary';

  ELSIF NEW.verification_type = 'pan' THEN
    v_dob := NULLIF(v_response->>'dob', '');

    IF v_dob IS NOT NULL THEN
      UPDATE loan_applicants
      SET dob = v_dob, updated_at = now()
      WHERE loan_application_id = NEW.loan_application_id
        AND applicant_type = 'primary';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_enrich_applicant_on_verification
  AFTER INSERT OR UPDATE OF status ON loan_verifications
  FOR EACH ROW
  WHEN (NEW.status = 'success')
  EXECUTE FUNCTION enrich_applicant_from_verification();
