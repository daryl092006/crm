-- ==========================================================================
-- MIGRATION : Templates et Scénarios de Relances — TASK-CRM-008
-- Date : 2026-06-28
-- ==========================================================================

-- ==========================================================================
-- 1. ENRICHISSEMENT DE LA TABLE MESSAGING_TEMPLATES (Non destructif)
-- ==========================================================================
ALTER TABLE public.messaging_templates
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.prospect_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_id TEXT, -- Fait référence au code textuel ou ID de lead_statuses
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();


-- ==========================================================================
-- 2. CRÉATION DE LA TABLE DES SCÉNARIOS DE RELANCE (FOLLOW-UP SCENARIOS)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.follow_up_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- no_answer, interested, documents_pending, etc.
  delay_days INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL DEFAULT 'whatsapp', -- whatsapp, email, sms, meeting
  template_id UUID REFERENCES public.messaging_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ==========================================================================
-- 3. INDEX DE PERFORMANCE NON DESTRUCTIFS
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_messaging_templates_campaign ON public.messaging_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messaging_templates_program ON public.messaging_templates(program_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_scenarios_trigger ON public.follow_up_scenarios(trigger_type);


-- ==========================================================================
-- 4. CONFIGURATION DE LA SECURITÉ RLS
-- ==========================================================================
ALTER TABLE public.messaging_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_scenarios ENABLE ROW LEVEL SECURITY;

-- 4.1 Politiques pour messaging_templates
DROP POLICY IF EXISTS "templates_select" ON public.messaging_templates;
CREATE POLICY "templates_select" ON public.messaging_templates
  FOR SELECT
  USING (
    get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
    OR
    -- Les agents ne lisent que les templates actifs
    (get_current_user_role() = 'agent' AND is_active = true)
  );

DROP POLICY IF EXISTS "templates_write" ON public.messaging_templates;
CREATE POLICY "templates_write" ON public.messaging_templates
  FOR INSERT
  WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));

DROP POLICY IF EXISTS "templates_update" ON public.messaging_templates;
CREATE POLICY "templates_update" ON public.messaging_templates
  FOR UPDATE
  USING (get_current_user_role() IN ('admin', 'superagent'));

DROP POLICY IF EXISTS "templates_delete" ON public.messaging_templates; -- Supprime toute policy DELETE éventuelle pour forcer l'archivage logique
-- Pas de policy DELETE créée. L'archivage se fait via is_active = false.


-- 4.2 Politiques pour follow_up_scenarios
DROP POLICY IF EXISTS "scenarios_select" ON public.follow_up_scenarios;
CREATE POLICY "scenarios_select" ON public.follow_up_scenarios
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "scenarios_write" ON public.follow_up_scenarios;
CREATE POLICY "scenarios_write" ON public.follow_up_scenarios
  FOR INSERT
  WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));

DROP POLICY IF EXISTS "scenarios_update" ON public.follow_up_scenarios;
CREATE POLICY "scenarios_update" ON public.follow_up_scenarios
  FOR UPDATE
  USING (get_current_user_role() IN ('admin', 'superagent'));

DROP POLICY IF EXISTS "scenarios_delete" ON public.follow_up_scenarios;
CREATE POLICY "scenarios_delete" ON public.follow_up_scenarios
  FOR DELETE
  USING (get_current_user_role() = 'admin');


-- ==========================================================================
-- 5. INSERTION DE MODÈLES DE MESSAGES DE DÉMONSTRATION SÛRS
-- ==========================================================================
INSERT INTO public.messaging_templates (title, content, category, subject, description, is_active, is_default, organization_id)
VALUES
(
  'Premier contact WhatsApp',
  'Bonjour {{first_name}}, je vous contacte suite à votre intérêt pour notre école. Êtes-vous disponible pour échanger sur la filière {{program_name}} ?',
  'whatsapp',
  NULL,
  'Premier message d''accueil automatique envoyé aux leads importés',
  true,
  true,
  '00000000-0000-0000-0000-000000000000'
),
(
  'Relance WhatsApp après silence',
  'Bonjour {{first_name}}, je n''ai pas réussi à vous joindre. Souhaitez-vous caler un créneau pour échanger au sujet de votre candidature pour la campagne {{campaign_name}} ?',
  'whatsapp',
  NULL,
  'Relance automatique après tentative d''appel sans réponse',
  true,
  false,
  '00000000-0000-0000-0000-000000000000'
),
(
  'Email d''information de filière',
  'Bonjour {{first_name}},\n\nNous vous remercions de votre intérêt pour la filière {{program_name}}.\n\nNous serions ravis de planifier un entretien d''orientation.\n\nCordialement,\n{{agent_name}}',
  'email',
  'Informations concernant la formation {{program_name}}',
  'Email de suivi détaillant les programmes de formation',
  true,
  true,
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT DO NOTHING;
