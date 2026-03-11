ALTER TABLE public.loan_applicants ADD COLUMN IF NOT EXISTS email_encrypted bytea;
-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
