-- ==========================================================================
-- MIGRATION : Interactions et Relances prospects — TASK-CRM-007
-- Date : 2026-06-28
-- ==========================================================================

-- ==========================================================================
-- 1. CRÉATION / ENRICHISSEMENT DE LA TABLE DES INTERACTIONS
-- ==========================================================================
-- Si la table existe déjà, on ajoute les colonnes manquantes de manière sûre.
CREATE TABLE IF NOT EXISTS public.lead_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'note', -- Note, WhatsApp, Email, SMS, Call
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajouter les nouveaux champs optionnels requis par le cahier des charges
ALTER TABLE public.lead_interactions
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS result TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ==========================================================================
-- 2. CRÉATION DE LA TABLE DES RELANCES (FOLLOW-UPS)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ NOT NULL,
  follow_up_type TEXT NOT NULL DEFAULT 'call', -- call, whatsapp, email, meeting, document, other
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, cancelled, overdue
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
  note TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ==========================================================================
-- 3. INDEX DE PERFORMANCE NON DESTRUCTIFS
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead_id ON public.lead_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_agent_id ON public.lead_interactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_created_at ON public.lead_interactions(created_at);

CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead_id ON public.lead_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_assigned_to ON public.lead_follow_ups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_due_at ON public.lead_follow_ups(due_at);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_status ON public.lead_follow_ups(status);


-- ==========================================================================
-- 4. ACTIVER ET CONFIGURER LA SÉCURISATION RLS
-- ==========================================================================
ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;

-- 4.1 Politiques pour lead_interactions
DROP POLICY IF EXISTS "lead_interactions_select" ON public.lead_interactions;
CREATE POLICY "lead_interactions_select" ON public.lead_interactions
  FOR SELECT
  USING (
    -- Admins, Direction, Superagents et Superviseurs lisent tout
    get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
    OR
    -- Un agent ne peut lire que les interactions de ses prospects assignés
    (
      get_current_user_role() = 'agent'
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_interactions.lead_id
        AND l.agent_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "lead_interactions_insert" ON public.lead_interactions;
CREATE POLICY "lead_interactions_insert" ON public.lead_interactions
  FOR INSERT
  WITH CHECK (
    -- Admins, Superagents peuvent insérer partout
    get_current_user_role() IN ('admin', 'superagent')
    OR
    -- Un agent ne peut insérer que sur ses prospects assignés
    (
      get_current_user_role() = 'agent'
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_interactions.lead_id
        AND l.agent_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "lead_interactions_delete" ON public.lead_interactions;
CREATE POLICY "lead_interactions_delete" ON public.lead_interactions
  FOR DELETE
  USING (get_current_user_role() = 'admin'); -- Seul l'admin supprime l'historique


-- 4.2 Politiques pour lead_follow_ups (Relances)
DROP POLICY IF EXISTS "lead_follow_ups_select" ON public.lead_follow_ups;
CREATE POLICY "lead_follow_ups_select" ON public.lead_follow_ups
  FOR SELECT
  USING (
    get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
    OR
    -- Les agents ne lisent que leurs relances assignées
    (get_current_user_role() = 'agent' AND assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "lead_follow_ups_insert" ON public.lead_follow_ups;
CREATE POLICY "lead_follow_ups_insert" ON public.lead_follow_ups
  FOR INSERT
  WITH CHECK (
    get_current_user_role() IN ('admin', 'superagent')
    OR
    -- Les agents peuvent planifier une relance sur leurs propres prospects
    (
      get_current_user_role() = 'agent'
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_follow_ups.lead_id
        AND l.agent_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "lead_follow_ups_update" ON public.lead_follow_ups;
CREATE POLICY "lead_follow_ups_update" ON public.lead_follow_ups
  FOR UPDATE
  USING (
    get_current_user_role() IN ('admin', 'superagent')
    OR
    -- Les agents peuvent mettre à jour leurs propres relances (les clore/marquer complétées)
    (get_current_user_role() = 'agent' AND assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "lead_follow_ups_delete" ON public.lead_follow_ups;
CREATE POLICY "lead_follow_ups_delete" ON public.lead_follow_ups
  FOR DELETE
  USING (get_current_user_role() = 'admin');
