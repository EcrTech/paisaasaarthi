-- Fix: non-admin users see blank entries on Leads page.
--
-- Two issues:
-- 1. A permissive org-wide SELECT policy on loan_applications (from 20260316)
--    was overriding the hierarchy-based policy, letting all users see all leads.
-- 2. Contacts linked to loan_applications were not visible to non-admins because
--    contacts only had hierarchy-based policies on assigned_to.
--
-- Fix:
-- 1. Drop the permissive org-wide loan_applications SELECT policy so only the
--    hierarchy-based policy (from 20260217) remains. Non-admins now only see
--    leads assigned to them or their reportees.
-- 2. Add a targeted contacts policy that allows viewing contacts linked to
--    loan_applications the user can already see (PostgreSQL applies RLS to
--    subqueries in policy expressions).

-- Remove the overly permissive loan_applications SELECT policy
DROP POLICY IF EXISTS "Users can view loan_applications in their org"
  ON public.loan_applications;

-- Allow viewing contacts linked to the user's visible loan applications
CREATE POLICY "Users can view contacts linked to their visible loan applications"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT contact_id FROM public.loan_applications
    WHERE contact_id IS NOT NULL
  )
);
