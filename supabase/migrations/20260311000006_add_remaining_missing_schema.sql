-- Missing columns
ALTER TABLE public.loan_applicants ADD COLUMN IF NOT EXISTS aadhaar_encrypted TEXT;
ALTER TABLE public.loan_approvals ADD COLUMN IF NOT EXISTS approved_tenure_days INTEGER;

-- Missing tables (exist on Lovable source but not in migrations)
CREATE TABLE IF NOT EXISTS public.dpdp_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  contact_id UUID,
  purpose TEXT,
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  withdrawal_timestamp TIMESTAMPTZ,
  data_categories JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dpdp_data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  contact_id UUID,
  request_type TEXT,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  response_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dpdp_encryption_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  field_name TEXT,
  table_name TEXT,
  encryption_type TEXT DEFAULT 'aes-256',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dpdp_pii_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  user_id UUID,
  table_name TEXT,
  field_name TEXT,
  record_id UUID,
  access_type TEXT,
  accessed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.crm_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  contact_id UUID,
  assigned_to UUID,
  subject TEXT,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.crm_tickets(id) ON DELETE CASCADE,
  user_id UUID,
  comment TEXT,
  is_internal BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.crm_tickets(id) ON DELETE CASCADE,
  changed_by UUID,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  user_id UUID,
  subject TEXT,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reapply_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID,
  contact_id UUID,
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.dpdp_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_encryption_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_pii_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reapply_tokens ENABLE ROW LEVEL SECURITY;
