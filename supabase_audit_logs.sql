-- ==========================================================================
-- MIGRATION : Système de Journalisation et Audit Logs — TASK-CRM-010
-- Date : 2026-06-28
-- ==========================================================================

-- ==========================================================================
-- 1. CRÉATION DE LA TABLE D'AUDIT LOGS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assurer l'existence de toutes les colonnes si la table a été créée autrement auparavant
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS old_values JSONB,
  ADD COLUMN IF NOT EXISTS new_values JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();



-- ==========================================================================
-- 2. INDEXATION POUR OPTIMISER LES FILTRES
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_campaign_id ON public.audit_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);


-- ==========================================================================
-- 3. ACTIVATION DE LA SÉCURISATION RLS
-- ==========================================================================
-- S'assurer que la table est d'abord créée et que Supabase la connaît
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;

CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT
  USING (
    get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
    OR
    (get_current_user_role() = 'agent' AND actor_id = auth.uid())
  );

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- PAS de politique de suppression (DELETE) ni de mise à jour (UPDATE) sur la table audit_logs
-- Ce qui garantit l'immutabilité des logs d'audit.


-- ==========================================================================
-- 4. FONCTION PL/PGSQL POUR FACILITER LA JOURNALISATION (SECURITY DEFINER)
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_actor_role TEXT;
  v_org_id UUID;
BEGIN
  -- Récupérer les informations de profil de l'acteur connecté
  SELECT role, organization_id
  INTO v_actor_role, v_org_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    campaign_id,
    organization_id,
    old_values,
    new_values,
    metadata,
    status,
    error_message
  )
  VALUES (
    auth.uid(),
    v_actor_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_campaign_id,
    v_org_id,
    p_old_values,
    p_new_values,
    p_metadata,
    p_status,
    p_error_message
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;
