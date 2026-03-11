-- Add missing columns to loan_applicants
ALTER TABLE public.loan_applicants ADD COLUMN IF NOT EXISTS alternate_mobile_encrypted bytea;
ALTER TABLE public.loan_applicants ADD COLUMN IF NOT EXISTS mobile_encrypted bytea;
ALTER TABLE public.loan_applicants ADD COLUMN IF NOT EXISTS pan_encrypted bytea;
ALTER TABLE public.loan_applicants ADD COLUMN IF NOT EXISTS bank_account_encrypted bytea;
ALTER TABLE public.loan_applicants ADD COLUMN IF NOT EXISTS bank_ifsc_encrypted bytea;

-- Drop and recreate tables with correct schemas
DROP TABLE IF EXISTS public.crm_ticket_history CASCADE;
DROP TABLE IF EXISTS public.crm_ticket_comments CASCADE;
DROP TABLE IF EXISTS public.crm_tickets CASCADE;
DROP TABLE IF EXISTS public.dpdp_consent_records CASCADE;
DROP TABLE IF EXISTS public.dpdp_data_requests CASCADE;
DROP TABLE IF EXISTS public.dpdp_encryption_config CASCADE;
DROP TABLE IF EXISTS public.dpdp_pii_access_log CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.reapply_tokens CASCADE;

CREATE TABLE public.crm_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_ticket_id text NOT NULL,
  ticket_number text,
  subject text NOT NULL,
  description text,
  category text,
  priority text,
  status text NOT NULL DEFAULT 'new',
  contact_name text,
  contact_email text,
  contact_phone text,
  source text,
  assigned_to text,
  due_at timestamptz,
  resolved_at timestamptz,
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_ticket_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_comment_id text NOT NULL,
  crm_ticket_id uuid NOT NULL REFERENCES public.crm_tickets(id) ON DELETE CASCADE,
  comment text NOT NULL,
  is_internal boolean DEFAULT false,
  created_by text,
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_ticket_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_history_id text NOT NULL,
  crm_ticket_id uuid NOT NULL REFERENCES public.crm_tickets(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_value text,
  new_value text,
  changed_by text,
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dpdp_consent_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  contact_id uuid,
  applicant_id uuid,
  user_identifier text NOT NULL,
  consent_version text NOT NULL DEFAULT '1.0',
  purpose text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dpdp_data_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  contact_id uuid,
  applicant_id uuid,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  description text,
  due_date timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  completed_at timestamptz,
  admin_notes text,
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dpdp_encryption_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  encryption_key text NOT NULL,
  is_active boolean DEFAULT true,
  configured_by uuid,
  configured_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.dpdp_pii_access_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  user_id uuid,
  contact_id uuid,
  applicant_id uuid,
  table_name text NOT NULL,
  column_name text,
  purpose text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  created_by uuid NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reapply_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL,
  org_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  parent_application_id uuid NOT NULL,
  mode text NOT NULL,
  referral_code text,
  created_by uuid,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_encryption_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_pii_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reapply_tokens ENABLE ROW LEVEL SECURITY;
