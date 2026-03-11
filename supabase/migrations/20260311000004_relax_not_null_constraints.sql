ALTER TABLE public.loan_applications ALTER COLUMN tenure_months DROP NOT NULL;
ALTER TABLE public.loan_sanctions ALTER COLUMN sanctioned_tenure DROP NOT NULL;
