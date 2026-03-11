-- Add columns that exist on source (Lovable) but not in our migrations
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone_encrypted TEXT;
ALTER TABLE public.loan_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.loan_eligibility ADD COLUMN IF NOT EXISTS recommended_tenure_days INTEGER;
ALTER TABLE public.loan_eligibility ADD COLUMN IF NOT EXISTS total_interest NUMERIC(12,2);
ALTER TABLE public.loan_eligibility ADD COLUMN IF NOT EXISTS total_repayment NUMERIC(12,2);
ALTER TABLE public.loan_eligibility ADD COLUMN IF NOT EXISTS daily_emi NUMERIC(12,2);
ALTER TABLE public.loan_sanctions ADD COLUMN IF NOT EXISTS sanctioned_tenure_days INTEGER;

-- Clear seed data that conflicts with source data
DELETE FROM public.loan_application_forms;
DELETE FROM public.feature_permissions;
DELETE FROM public.pipeline_stages WHERE id NOT IN (SELECT id FROM public.pipeline_stages LIMIT 0);
