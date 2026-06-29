-- ==========================================================================
-- MIGRATION : Sécurisation RLS par rôle — TASK-DB-002
-- Date : 2026-06-28
-- ==========================================================================
-- Objectif :
--   Remplacer les 13 politiques bypass USING(true) par des politiques
--   granulaires basées sur les 5 rôles : admin, direction, superagent,
--   agent, superviseur.
--
-- Impact :
--   - Aucune donnée supprimée, modifiée ou réinitialisée.
--   - Seules les RÈGLES D'ACCÈS (politiques RLS) sont remplacées.
--   - Les tables, colonnes et lignes existantes sont intactes.
--
-- Retour arrière :
--   Pour revenir à l'état précédent (bypass total), ré-exécuter :
--     CREATE POLICY "leads_full_access" ON leads FOR ALL USING (true);
--   etc. pour chaque table.
-- ==========================================================================


-- ==========================================================================
-- ÉTAPE 1 — FONCTION UTILITAIRE : récupérer le rôle de l'utilisateur
-- ==========================================================================
-- Pourquoi : toutes les politiques ont besoin de connaître le rôle de
-- l'utilisateur connecté. On centralise cette logique dans une fonction
-- SECURITY DEFINER (exécutée avec les droits du propriétaire, pas du
-- requêteur, ce qui évite les boucles RLS sur profiles).
-- Impact : création ou remplacement d'une fonction, aucune donnée touchée.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Mise à jour de is_admin() pour couvrir le vrai admin uniquement
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (role = 'admin')
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Nouvelle fonction : vrai si le rôle a un accès lecture étendu
-- (admin, direction, superagent, superviseur)
CREATE OR REPLACE FUNCTION public.has_read_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role IN ('admin', 'direction', 'superagent', 'superviseur')
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Nouvelle fonction : vrai si le rôle peut modifier les prospects
-- (admin, superagent)
CREATE OR REPLACE FUNCTION public.can_manage_leads()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role IN ('admin', 'superagent')
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;


-- ==========================================================================
-- ÉTAPE 2 — TABLE : leads (prospects)
-- Table prioritaire : contient les données les plus sensibles.
-- ==========================================================================
-- Règles cibles :
--   SELECT : admin, direction, superagent, superviseur → tous les leads
--            agent → uniquement ses leads (agent_id = auth.uid())
--   INSERT : admin, superagent
--   UPDATE : admin, superagent → tous les leads
--            agent → uniquement ses leads assignés
--   DELETE : admin uniquement
-- ==========================================================================

DROP POLICY IF EXISTS "leads_full_access" ON public.leads;

-- Lecture : admin/direction/superagent/superviseur voient tout
--           agent voit uniquement ses leads assignés
CREATE POLICY "leads_select"
ON public.leads FOR SELECT
USING (
  get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
  OR (
    get_current_user_role() = 'agent'
    AND agent_id = auth.uid()
  )
);

-- Insertion : admin et superagent peuvent créer des leads
CREATE POLICY "leads_insert"
ON public.leads FOR INSERT
WITH CHECK (
  get_current_user_role() IN ('admin', 'superagent')
);

-- Mise à jour :
--   admin/superagent → tous les leads
--   agent → uniquement ses leads assignés
CREATE POLICY "leads_update"
ON public.leads FOR UPDATE
USING (
  get_current_user_role() IN ('admin', 'superagent')
  OR (
    get_current_user_role() = 'agent'
    AND agent_id = auth.uid()
  )
)
WITH CHECK (
  get_current_user_role() IN ('admin', 'superagent')
  OR (
    get_current_user_role() = 'agent'
    AND agent_id = auth.uid()
  )
);

-- Suppression : admin uniquement
CREATE POLICY "leads_delete"
ON public.leads FOR DELETE
USING (
  get_current_user_role() = 'admin'
);


-- ==========================================================================
-- ÉTAPE 3 — TABLE : lead_interactions
-- ==========================================================================
-- Règles cibles :
--   SELECT : admin, direction, superagent, superviseur → toutes
--            agent → interactions sur ses propres leads
--   INSERT : admin, superagent → toutes
--            agent → sur ses propres leads uniquement
--   UPDATE/DELETE : admin, superagent
-- ==========================================================================

DROP POLICY IF EXISTS "interactions_full_access" ON public.lead_interactions;

CREATE POLICY "interactions_select"
ON public.lead_interactions FOR SELECT
USING (
  get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
  OR (
    get_current_user_role() = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_interactions.lead_id
        AND leads.agent_id = auth.uid()
    )
  )
);

CREATE POLICY "interactions_insert"
ON public.lead_interactions FOR INSERT
WITH CHECK (
  get_current_user_role() IN ('admin', 'superagent')
  OR (
    get_current_user_role() = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_interactions.lead_id
        AND leads.agent_id = auth.uid()
    )
  )
);

CREATE POLICY "interactions_update"
ON public.lead_interactions FOR UPDATE
USING (
  get_current_user_role() IN ('admin', 'superagent')
);

CREATE POLICY "interactions_delete"
ON public.lead_interactions FOR DELETE
USING (
  get_current_user_role() = 'admin'
);


-- ==========================================================================
-- ÉTAPE 4 — TABLE : appointments (relances/RDV)
-- ==========================================================================
-- Règles cibles :
--   SELECT : admin, direction, superagent, superviseur → tous
--            agent → ses propres relances
--   INSERT/UPDATE : admin, superagent, agent (sur ses leads)
--   DELETE : admin
-- ==========================================================================

DROP POLICY IF EXISTS "appointments_full_access" ON public.appointments;

CREATE POLICY "appointments_select"
ON public.appointments FOR SELECT
USING (
  get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
  OR (
    get_current_user_role() = 'agent'
    AND agent_id = auth.uid()
  )
);

CREATE POLICY "appointments_insert"
ON public.appointments FOR INSERT
WITH CHECK (
  get_current_user_role() IN ('admin', 'superagent')
  OR (
    get_current_user_role() = 'agent'
    AND agent_id = auth.uid()
  )
);

CREATE POLICY "appointments_update"
ON public.appointments FOR UPDATE
USING (
  get_current_user_role() IN ('admin', 'superagent')
  OR (
    get_current_user_role() = 'agent'
    AND agent_id = auth.uid()
  )
);

CREATE POLICY "appointments_delete"
ON public.appointments FOR DELETE
USING (
  get_current_user_role() = 'admin'
);


-- ==========================================================================
-- ÉTAPE 5 — TABLE : campaigns
-- ==========================================================================
-- Règles cibles :
--   SELECT : tous les rôles authentifiés
--   INSERT : admin, superagent
--   UPDATE : admin, superagent
--   DELETE : admin
-- ==========================================================================

DROP POLICY IF EXISTS "campaigns_full_access" ON public.campaigns;

CREATE POLICY "campaigns_select"
ON public.campaigns FOR SELECT
USING (
  auth.uid() IS NOT NULL
);

CREATE POLICY "campaigns_insert"
ON public.campaigns FOR INSERT
WITH CHECK (
  get_current_user_role() IN ('admin', 'superagent')
);

CREATE POLICY "campaigns_update"
ON public.campaigns FOR UPDATE
USING (
  get_current_user_role() IN ('admin', 'superagent')
);

CREATE POLICY "campaigns_delete"
ON public.campaigns FOR DELETE
USING (
  get_current_user_role() = 'admin'
);


-- ==========================================================================
-- ÉTAPE 6 — TABLE : profiles
-- ==========================================================================
-- Règles cibles :
--   SELECT : chaque utilisateur voit son propre profil
--            admin et superagent voient tous les profils
--            direction, superviseur voient tous (pour stats)
--   INSERT : admin (via Edge Function qui utilise service_role)
--   UPDATE : chaque utilisateur peut modifier son propre profil
--            admin peut tout modifier
--   DELETE : admin uniquement
-- ==========================================================================

DROP POLICY IF EXISTS "profile_full_access" ON public.profiles;

CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR get_current_user_role() IN ('admin', 'superagent', 'direction', 'superviseur')
);

CREATE POLICY "profiles_insert"
ON public.profiles FOR INSERT
WITH CHECK (
  get_current_user_role() = 'admin'
  OR id = auth.uid()   -- permet l'auto-création à l'activation du compte
);

CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING (
  id = auth.uid()
  OR get_current_user_role() = 'admin'
);

CREATE POLICY "profiles_delete"
ON public.profiles FOR DELETE
USING (
  get_current_user_role() = 'admin'
);


-- ==========================================================================
-- ÉTAPE 7 — TABLE : invitations
-- ==========================================================================
-- Règles cibles :
--   SELECT : admin, superagent (pour gérer l'équipe)
--   INSERT : admin, superagent
--   UPDATE : admin
--   DELETE : admin
-- ==========================================================================

DROP POLICY IF EXISTS "invitations_full_access" ON public.invitations;

CREATE POLICY "invitations_select"
ON public.invitations FOR SELECT
USING (
  get_current_user_role() IN ('admin', 'superagent')
);

CREATE POLICY "invitations_insert"
ON public.invitations FOR INSERT
WITH CHECK (
  get_current_user_role() IN ('admin', 'superagent')
);

CREATE POLICY "invitations_update"
ON public.invitations FOR UPDATE
USING (
  get_current_user_role() = 'admin'
);

CREATE POLICY "invitations_delete"
ON public.invitations FOR DELETE
USING (
  get_current_user_role() = 'admin'
);


-- ==========================================================================
-- ÉTAPE 8 — TABLE : messaging_templates
-- ==========================================================================
-- Règles cibles :
--   SELECT : tous les rôles
--   INSERT/UPDATE : admin, superagent
--   DELETE : admin
-- ==========================================================================

DROP POLICY IF EXISTS "templates_full_access" ON public.messaging_templates;

CREATE POLICY "templates_select"
ON public.messaging_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "templates_insert"
ON public.messaging_templates FOR INSERT
WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));

CREATE POLICY "templates_update"
ON public.messaging_templates FOR UPDATE
USING (get_current_user_role() IN ('admin', 'superagent'));

CREATE POLICY "templates_delete"
ON public.messaging_templates FOR DELETE
USING (get_current_user_role() = 'admin');


-- ==========================================================================
-- ÉTAPE 9 — TABLE : tasks
-- ==========================================================================

DROP POLICY IF EXISTS "tasks_full_access" ON public.tasks;

CREATE POLICY "tasks_select"
ON public.tasks FOR SELECT
USING (
  get_current_user_role() IN ('admin', 'direction', 'superagent', 'superviseur')
  OR (
    get_current_user_role() = 'agent'
    AND agent_id = auth.uid()
  )
);

CREATE POLICY "tasks_insert"
ON public.tasks FOR INSERT
WITH CHECK (
  get_current_user_role() IN ('admin', 'superagent')
  OR (
    get_current_user_role() = 'agent'
    AND agent_id = auth.uid()
  )
);

CREATE POLICY "tasks_update"
ON public.tasks FOR UPDATE
USING (
  get_current_user_role() IN ('admin', 'superagent')
  OR (
    get_current_user_role() = 'agent'
    AND agent_id = auth.uid()
  )
);

CREATE POLICY "tasks_delete"
ON public.tasks FOR DELETE
USING (get_current_user_role() = 'admin');


-- ==========================================================================
-- ÉTAPE 10 — TABLES DIVERSES (lecture élargie / admin uniquement pour écriture)
-- ==========================================================================

-- lead_statuses : tout le monde lit, admin et superagent gèrent
DROP POLICY IF EXISTS "statuses_full_access" ON public.lead_statuses;
CREATE POLICY "statuses_select" ON public.lead_statuses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "statuses_write"  ON public.lead_statuses FOR INSERT WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "statuses_update" ON public.lead_statuses FOR UPDATE USING (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "statuses_delete" ON public.lead_statuses FOR DELETE USING (get_current_user_role() = 'admin');

-- sequences : admin et superagent gèrent, tous lisent
DROP POLICY IF EXISTS "sequences_full_access" ON public.sequences;
CREATE POLICY "sequences_select" ON public.sequences FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sequences_write"  ON public.sequences FOR INSERT WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "sequences_update" ON public.sequences FOR UPDATE USING (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "sequences_delete" ON public.sequences FOR DELETE USING (get_current_user_role() = 'admin');

-- sequence_steps : idem sequences
DROP POLICY IF EXISTS "steps_full_access" ON public.sequence_steps;
CREATE POLICY "steps_select" ON public.sequence_steps FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "steps_write"  ON public.sequence_steps FOR INSERT WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "steps_update" ON public.sequence_steps FOR UPDATE USING (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "steps_delete" ON public.sequence_steps FOR DELETE USING (get_current_user_role() = 'admin');

-- lead_documents : agents voient les docs de leurs leads, admin/superagent tout
DROP POLICY IF EXISTS "docs_full_access" ON public.lead_documents;
CREATE POLICY "docs_select" ON public.lead_documents FOR SELECT
USING (
  get_current_user_role() IN ('admin', 'superagent', 'direction', 'superviseur')
  OR EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_documents.lead_id AND leads.agent_id = auth.uid()
  )
);
CREATE POLICY "docs_write"  ON public.lead_documents FOR INSERT WITH CHECK (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "docs_update" ON public.lead_documents FOR UPDATE USING (get_current_user_role() IN ('admin', 'superagent'));
CREATE POLICY "docs_delete" ON public.lead_documents FOR DELETE USING (get_current_user_role() = 'admin');

-- organizations : tous les authentifiés lisent leur org, admin écrit
DROP POLICY IF EXISTS "org_full_access" ON public.organizations;
CREATE POLICY "org_select" ON public.organizations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_update"  ON public.organizations FOR UPDATE USING (get_current_user_role() = 'admin');
CREATE POLICY "org_insert"  ON public.organizations FOR INSERT WITH CHECK (get_current_user_role() = 'admin');

-- notifications : chaque utilisateur voit ses propres notifications
DROP POLICY IF EXISTS "notifications_full_access" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- audit_logs : admin et direction lisent, personne n'écrit directement (triggers uniquement)
DROP POLICY IF EXISTS "audit_full_access" ON public.audit_logs;
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT USING (get_current_user_role() IN ('admin', 'direction'));
-- Note : les insertions dans audit_logs sont faites par des triggers SECURITY DEFINER,
-- pas par l'utilisateur directement. Pas de policy INSERT/UPDATE/DELETE ici.


-- ==========================================================================
-- ÉTAPE 11 — VÉRIFICATION
-- ==========================================================================
-- Exécuter après la migration pour confirmer que toutes les politiques
-- ont bien été créées :

SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
