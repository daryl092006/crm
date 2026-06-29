-- =========================================================
-- MIGRATION : Extension du système de rôles
-- TASK-DB-001 — Refonte du système de rôles
-- Date : 2026-06-28
-- Version : 2 — Gestion des valeurs hors périmètre préexistantes
-- =========================================================
-- Objectif : Étendre les rôles autorisés de 2 à 5 niveaux.
-- Rôles actuels  : 'admin', 'agent'
-- Rôles cibles   : 'admin', 'direction', 'superagent', 'agent', 'superviseur'
--
-- POURQUOI L'ERREUR s'est produite :
--   La base contient des lignes dont le champ 'role' a une valeur
--   non prévue (ex: NULL, chaîne vide '', ou autre).
--   PostgreSQL refuse d'ajouter une contrainte CHECK si des lignes
--   existantes la violent déjà.
--
-- STRATÉGIE :
--   ÉTAPE 0 — Diagnostiquer les valeurs actuelles (lecture seule)
--   ÉTAPE 1 — Corriger les valeurs non standard → 'agent' (défaut safe)
--   ÉTAPE 2 — Supprimer l'ancienne contrainte et en créer une nouvelle
-- =========================================================


-- =========================================================
-- ÉTAPE 0 — DIAGNOSTIC (LECTURE SEULE)
-- Exécutez ces requêtes AVANT de lancer les étapes 1 et 2.
-- Elles vous montrent quelles lignes posent problème.
-- =========================================================

-- 0a. Voir tous les rôles actuellement présents dans profiles :
SELECT id, full_name, email, role
FROM public.profiles
ORDER BY role;

-- 0b. Voir les lignes qui vont violer la nouvelle contrainte :
SELECT id, full_name, email, role
FROM public.profiles
WHERE role IS NULL
   OR role NOT IN ('admin', 'direction', 'superagent', 'agent', 'superviseur');

-- 0c. Même chose pour invitations :
SELECT id, email, role, status
FROM public.invitations
WHERE role IS NULL
   OR role NOT IN ('admin', 'direction', 'superagent', 'agent', 'superviseur');


-- =========================================================
-- ÉTAPE 1 — SUPPRESSION DES ANCIENNES CONTRAINTES EN PREMIER
-- IMPORTANT : On supprime les contraintes AVANT les UPDATE,
-- sinon l'ancienne contrainte ('admin','agent') bloque les
-- nouvelles valeurs ('superviseur', 'direction', 'superagent').
-- =========================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_role_check;


-- =========================================================
-- ÉTAPE 2 — MAPPING SÉMANTIQUE DES RÔLES NON STANDARD
-- Valeurs trouvées en base et leur mapping :
--   'observer'    → 'superviseur'  (lecture étendue, observation)
--   'super_admin' → 'direction'    (Direction ESCEN, lecture KPIs)
--   'super_agent' → 'superagent'   (même concept, sans underscore)
-- Les lignes avec 'admin' ou 'agent' valides ne sont PAS touchées.
-- =========================================================

UPDATE public.profiles SET role = 'superviseur' WHERE role = 'observer';
UPDATE public.profiles SET role = 'direction'   WHERE role = 'super_admin';
UPDATE public.profiles SET role = 'superagent'  WHERE role = 'super_agent';

-- Filet de sécurité : toute autre valeur inconnue → 'agent'
UPDATE public.profiles
SET role = 'agent'
WHERE role IS NULL
   OR role NOT IN ('admin', 'direction', 'superagent', 'agent', 'superviseur');

-- Même correctif pour invitations
UPDATE public.invitations
SET role = 'agent'
WHERE role IS NULL
   OR role NOT IN ('admin', 'direction', 'superagent', 'agent', 'superviseur');


-- =========================================================
-- ÉTAPE 3 — RECRÉER LES CONTRAINTES AVEC LES 5 RÔLES
-- Maintenant que toutes les lignes sont conformes.
-- =========================================================

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'direction', 'superagent', 'agent', 'superviseur'));

ALTER TABLE public.invitations
    ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('admin', 'direction', 'superagent', 'agent', 'superviseur'));


-- =========================================================
-- ÉTAPE 3 — VÉRIFICATION FINALE (après migration complète)
-- =========================================================

-- 3a. Vérifier que les nouvelles contraintes sont en place :
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (
    'public.profiles'::regclass,
    'public.invitations'::regclass
)
  AND conname LIKE '%role%';

-- 3b. Vérifier la distribution des rôles après correction :
SELECT 'profiles' AS table_name, role, COUNT(*) FROM public.profiles GROUP BY role
UNION ALL
SELECT 'invitations', role, COUNT(*) FROM public.invitations GROUP BY role
ORDER BY table_name, role;

