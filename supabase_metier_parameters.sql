-- ==========================================================================
-- MIGRATION : Paramétrage métier dynamique — TASK-CRM-006
-- Date : 2026-06-28
-- ==========================================================================

-- ==========================================================================
-- 1. CRÉATION DES TABLES DE RÉFÉRENTIELS (Non destructif)
-- ==========================================================================

-- 1.1 FILIÈRES / PROGRAMMES
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  level TEXT, -- Licence, Master, Executive
  department TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 CLASSEMENTS DE PROSPECTS
CREATE TABLE IF NOT EXISTS public.prospect_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.3 SOURCES DE PROSPECTS
CREATE TABLE IF NOT EXISTS public.prospect_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ==========================================================================
-- 2. AJOUT DES LIAISONS DANS LA TABLE LEADS (Non destructif)
-- ==========================================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classification_id UUID REFERENCES public.prospect_classifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.prospect_sources(id) ON DELETE SET NULL;


-- ==========================================================================
-- 3. SÉCURISATION RLS SUR LES RÉFÉRENTIELS
-- ==========================================================================
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_sources ENABLE ROW LEVEL SECURITY;

-- Politiques programs
CREATE POLICY "programs_select" ON public.programs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "programs_write" ON public.programs FOR INSERT WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "programs_update" ON public.programs FOR UPDATE USING (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "programs_delete" ON public.programs FOR DELETE USING (get_current_user_role() = 'admin');

-- Politiques classifications
CREATE POLICY "classifications_select" ON public.prospect_classifications FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "classifications_write" ON public.prospect_classifications FOR INSERT WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "classifications_update" ON public.prospect_classifications FOR UPDATE USING (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "classifications_delete" ON public.prospect_classifications FOR DELETE USING (get_current_user_role() = 'admin');

-- Politiques sources
CREATE POLICY "sources_select" ON public.prospect_sources FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sources_write" ON public.prospect_sources FOR INSERT WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "sources_update" ON public.prospect_sources FOR UPDATE USING (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "sources_delete" ON public.prospect_sources FOR DELETE USING (get_current_user_role() = 'admin');


-- ==========================================================================
-- 4. INSERTION DES DONNÉES PAR DÉFAUT (Pour l'organisation démo)
-- ==========================================================================
-- Liaison avec l'organisation par défaut '00000000-0000-0000-0000-000000000000'
-- ==========================================================================

-- Programs
INSERT INTO public.programs (name, code, level, organization_id)
VALUES
('Intelligence Artificielle & Génie Logiciel', 'ia_gl', 'Master', '00000000-0000-0000-0000-000000000000'),
('Marketing Digital & E-commerce', 'mkt_eco', 'Master', '00000000-0000-0000-0000-000000000000'),
('Management de Projet Numérique', 'mpn', 'Master', '00000000-0000-0000-0000-000000000000'),
('Finance Digitale', 'fd', 'Master', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (code) DO NOTHING;

-- Classifications
INSERT INTO public.prospect_classifications (name, code, color, sort_order, is_default, organization_id)
VALUES
('Prospect chaud', 'hot', '#ef4444', 1, false, '00000000-0000-0000-0000-000000000000'),
('Prospect tiède', 'warm', '#f59e0b', 2, true, '00000000-0000-0000-0000-000000000000'),
('Prospect froid', 'cold', '#3b82f6', 3, false, '00000000-0000-0000-0000-000000000000'),
('Prioritaire', 'priority', '#a855f7', 4, false, '00000000-0000-0000-0000-000000000000')
ON CONFLICT (code) DO NOTHING;

-- Sources
INSERT INTO public.prospect_sources (name, code, organization_id)
VALUES
('Facebook', 'facebook', '00000000-0000-0000-0000-000000000000'),
('LinkedIn', 'linkedin', '00000000-0000-0000-0000-000000000000'),
('Instagram', 'instagram', '00000000-0000-0000-0000-000000000000'),
('TikTok', 'tiktok', '00000000-0000-0000-0000-000000000000'),
('Salon d''orientation', 'fair', '00000000-0000-0000-0000-000000000000'),
('Appel entrant', 'inbound_call', '00000000-0000-0000-0000-000000000000'),
('Terrain', 'field', '00000000-0000-0000-0000-000000000000'),
('Campus / JPO', 'campus', '00000000-0000-0000-0000-000000000000'),
('Formulaire web', 'web_form', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (code) DO NOTHING;
