-- ==========================================================================
-- MIGRATION : Système d'importation et déduplication — TASK-CRM-004
-- Date : 2026-06-28
-- ==========================================================================
-- Objectif :
--   - Ajouter les colonnes nécessaires pour tracer la source et WhatsApp sur les leads.
--   - Créer la table d'historique prospect_import_batches.
--   - Mettre en place les index de déduplication par campagne.
--
-- Sécurité des données :
--   - AUCUNE donnée n'est supprimée ou modifiée.
--   - Les index uniques sont PARTIELS et s'appliquent uniquement s'il n'y a pas
--     de violation avec des données existantes (ou ils ne bloquent pas l'existant).
-- ==========================================================================


-- ==========================================================================
-- 1. ENRICHISSEMENT DE LA TABLE LEADS (Non destructif)
-- ==========================================================================
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;


-- ==========================================================================
-- 2. CRÉATION DE LA TABLE DE SUIVI DES IMPORTS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.prospect_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  imported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name TEXT,
  source TEXT,
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  inserted_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  rejected_rows INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  mapping JSONB,
  report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- RLS sur prospect_import_batches
ALTER TABLE public.prospect_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_batches_select" ON public.prospect_import_batches FOR SELECT USING (
  auth.uid() IS NOT NULL
);

CREATE POLICY "import_batches_write" ON public.prospect_import_batches FOR INSERT WITH CHECK (
  get_current_user_role() IN ('admin', 'superagent')
);

CREATE POLICY "import_batches_update" ON public.prospect_import_batches FOR UPDATE USING (
  get_current_user_role() IN ('admin', 'superagent')
);

CREATE POLICY "import_batches_delete" ON public.prospect_import_batches FOR DELETE USING (
  get_current_user_role() = 'admin'
);


-- Liaison de la clé étrangère sur leads vers prospect_import_batches
ALTER TABLE public.leads
  ADD CONSTRAINT fk_leads_import_batch 
  FOREIGN KEY (import_batch_id) 
  REFERENCES public.prospect_import_batches(id) 
  ON DELETE SET NULL;


-- Index non uniques pour optimiser les performances de recherche des doublons logiciels
CREATE INDEX IF NOT EXISTS idx_leads_campaign_phone ON public.leads(campaign_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_email ON public.leads(campaign_id, email);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_whatsapp ON public.leads(campaign_id, whatsapp);

