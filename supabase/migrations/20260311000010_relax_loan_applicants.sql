-- Relax NOT NULL constraints on loan_applicants to allow source data with nulls
ALTER TABLE public.loan_applicants ALTER COLUMN dob DROP NOT NULL;
ALTER TABLE public.loan_applicants ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.loan_applicants ALTER COLUMN mobile DROP NOT NULL;
ALTER TABLE public.loan_applicants ALTER COLUMN org_id DROP NOT NULL;
NOTIFY pgrst, 'reload schema';
