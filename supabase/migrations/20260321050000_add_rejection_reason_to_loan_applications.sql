-- Add rejection_reason column to loan_applications
-- Stores the standardized reason when a loan application is rejected.
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS rejection_reason text;
