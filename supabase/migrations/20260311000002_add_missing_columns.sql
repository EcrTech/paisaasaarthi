-- Add columns that exist on source but not target
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_encrypted TEXT;
