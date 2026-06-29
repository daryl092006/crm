-- ==========================================================================
-- MIGRATION : Enrichissement de la table campaigns — TASK-CRM-005
-- Date : 2026-06-28
-- ==========================================================================
-- Objectif :
--   - Ajouter les colonnes manquantes pour le cycle de vie des campagnes.
--   - Conserver les données existantes intactes.
-- ==========================================================================

-- 1. Ajouter les colonnes manquantes
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS objective INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Migrer le statut pour les campagnes existantes
-- Si une campagne était active (is_active = true), on la passe à 'active'.
-- Sinon, on la passe à 'paused'.
UPDATE public.campaigns
SET status = CASE 
  WHEN is_active = TRUE THEN 'active'::text
  ELSE 'paused'::text
END
WHERE status = 'draft'; -- N'applique la migration que pour l'existant qui prend le défaut 'draft'

-- 3. Ajouter la contrainte check de statut
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'));

-- 4. Index de recherche pour optimiser les filtres par statut
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
