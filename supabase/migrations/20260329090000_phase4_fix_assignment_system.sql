-- Phase 4: Fix Assignment System
-- 4a: assign_application RPC (updates assigned_to + round-robin)
-- 4b: Audit trigger for all assignment changes
-- 4c: AssignmentDialog wired in frontend (see .tsx change)

-- ============================================================
-- 4b: Audit trigger — auto-logs ALL assigned_to changes
-- Catches manual reassignment, auto-assignment, and edge function updates
-- ============================================================

CREATE OR REPLACE FUNCTION log_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO loan_audit_log (
    loan_application_id,
    action_type,
    action_by,
    old_value,
    new_value
  ) VALUES (
    NEW.id,
    CASE
      WHEN OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL THEN 'assignment'
      WHEN OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL THEN 'unassignment'
      ELSE 'reassignment'
    END,
    auth.uid(),
    jsonb_build_object('assigned_to', OLD.assigned_to),
    jsonb_build_object('assigned_to', NEW.assigned_to)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_assignment_change
  AFTER UPDATE OF assigned_to ON loan_applications
  FOR EACH ROW
  WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  EXECUTE FUNCTION log_assignment_change();

-- ============================================================
-- 4a: assign_application RPC
-- Single call for manual reassignment:
--   1. Updates assigned_to on loan_applications
--   2. Audit log auto-created by trigger above
--   3. Returns new assignment state
-- ============================================================

CREATE OR REPLACE FUNCTION assign_application(
  p_application_id uuid,
  p_new_assignee uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_assignee uuid;
  v_org_id uuid;
BEGIN
  -- Get current state
  SELECT assigned_to, org_id
  INTO v_old_assignee, v_org_id
  FROM loan_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found: %', p_application_id;
  END IF;

  -- No-op if same
  IF v_old_assignee IS NOT DISTINCT FROM p_new_assignee THEN
    RETURN json_build_object(
      'changed', false,
      'assignedTo', p_new_assignee
    );
  END IF;

  -- Update assignment
  UPDATE loan_applications
  SET assigned_to = p_new_assignee, updated_at = now()
  WHERE id = p_application_id;

  -- Update round-robin state so it knows about this manual assignment
  IF p_new_assignee IS NOT NULL THEN
    INSERT INTO loan_assignment_config (org_id, last_assigned_user_id, last_assigned_at)
    VALUES (v_org_id, p_new_assignee, now())
    ON CONFLICT (org_id) DO UPDATE
    SET last_assigned_user_id = EXCLUDED.last_assigned_user_id,
        last_assigned_at = EXCLUDED.last_assigned_at,
        updated_at = now();
  END IF;

  RETURN json_build_object(
    'changed', true,
    'previousAssignee', v_old_assignee,
    'assignedTo', p_new_assignee
  );
END;
$$;
