-- ==========================================================================
-- MIGRATION : Module d'envoi d'emails en masse — TASK-CRM-012
-- Date : 2026-06-28
-- ==========================================================================

-- 1. TABLES

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_id UUID REFERENCES public.messaging_templates(id) ON DELETE SET NULL,
  crm_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  sender_name TEXT,
  sender_email TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  target_type TEXT NOT NULL DEFAULT 'crm_filter',
  filters JSONB DEFAULT '{}'::jsonb,
  total_recipients INTEGER DEFAULT 0,
  valid_recipients INTEGER DEFAULT 0,
  invalid_recipients INTEGER DEFAULT 0,
  duplicate_recipients INTEGER DEFAULT 0,
  queued_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  phone TEXT,
  source TEXT,
  program_name TEXT,
  campaign_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  validation_status TEXT NOT NULL DEFAULT 'valid',
  validation_error TEXT,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  personalized_subject TEXT,
  personalized_body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_bucket TEXT DEFAULT 'email-attachments',
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.email_recipients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. INDEXES

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_by ON public.email_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_crm_campaign_id ON public.email_campaigns(crm_campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_campaign ON public.email_recipients(email_campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_email ON public.email_recipients(email);
CREATE INDEX IF NOT EXISTS idx_email_recipients_lead_id ON public.email_recipients(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_campaign ON public.email_send_logs(email_campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_status ON public.email_send_logs(status);

-- 3. RLS ACTIVATION

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES

-- email_campaigns
DROP POLICY IF EXISTS "email_campaigns_select" ON public.email_campaigns;
CREATE POLICY "email_campaigns_select" ON public.email_campaigns
  FOR SELECT USING (
    public.get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
    OR (public.get_current_user_role() = 'agent' AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "email_campaigns_insert" ON public.email_campaigns;
CREATE POLICY "email_campaigns_insert" ON public.email_campaigns
  FOR INSERT WITH CHECK (
    public.get_current_user_role() IN ('admin', 'superagent')
  );

DROP POLICY IF EXISTS "email_campaigns_update" ON public.email_campaigns;
CREATE POLICY "email_campaigns_update" ON public.email_campaigns
  FOR UPDATE USING (
    public.get_current_user_role() IN ('admin', 'superagent')
  );

-- email_recipients
DROP POLICY IF EXISTS "email_recipients_select" ON public.email_recipients;
CREATE POLICY "email_recipients_select" ON public.email_recipients
  FOR SELECT USING (
    public.get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
  );

DROP POLICY IF EXISTS "email_recipients_insert" ON public.email_recipients;
CREATE POLICY "email_recipients_insert" ON public.email_recipients
  FOR INSERT WITH CHECK (
    public.get_current_user_role() IN ('admin', 'superagent')
  );

DROP POLICY IF EXISTS "email_recipients_update" ON public.email_recipients;
CREATE POLICY "email_recipients_update" ON public.email_recipients
  FOR UPDATE USING (
    public.get_current_user_role() IN ('admin', 'superagent')
  );

-- email_attachments
DROP POLICY IF EXISTS "email_attachments_select" ON public.email_attachments;
CREATE POLICY "email_attachments_select" ON public.email_attachments
  FOR SELECT USING (
    public.get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
  );

DROP POLICY IF EXISTS "email_attachments_insert" ON public.email_attachments;
CREATE POLICY "email_attachments_insert" ON public.email_attachments
  FOR INSERT WITH CHECK (
    public.get_current_user_role() IN ('admin', 'superagent')
  );

DROP POLICY IF EXISTS "email_attachments_delete" ON public.email_attachments;
CREATE POLICY "email_attachments_delete" ON public.email_attachments
  FOR DELETE USING (
    public.get_current_user_role() IN ('admin', 'superagent')
  );

-- email_send_logs
DROP POLICY IF EXISTS "email_send_logs_select" ON public.email_send_logs;
CREATE POLICY "email_send_logs_select" ON public.email_send_logs
  FOR SELECT USING (
    public.get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
  );

DROP POLICY IF EXISTS "email_send_logs_insert" ON public.email_send_logs;
CREATE POLICY "email_send_logs_insert" ON public.email_send_logs
  FOR INSERT WITH CHECK (
    public.get_current_user_role() IN ('admin', 'superagent')
  );

-- 5. STORAGE BUCKET REGISTER

INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for email-attachments
DROP POLICY IF EXISTS "email_attachments_storage_insert" ON storage.objects;
CREATE POLICY "email_attachments_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'email-attachments' AND
    (public.get_current_user_role() IN ('admin', 'superagent'))
  );

DROP POLICY IF EXISTS "email_attachments_storage_select" ON storage.objects;
CREATE POLICY "email_attachments_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'email-attachments' AND
    (public.get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur'))
  );

DROP POLICY IF EXISTS "email_attachments_storage_delete" ON storage.objects;
CREATE POLICY "email_attachments_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'email-attachments' AND
    (public.get_current_user_role() IN ('admin', 'superagent'))
  );
