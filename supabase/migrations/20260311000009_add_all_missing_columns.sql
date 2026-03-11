-- loan_applicants: add org_id and other missing columns
ALTER TABLE public.loan_applicants ADD COLUMN IF NOT EXISTS org_id uuid;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
