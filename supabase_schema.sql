-- # EliteCRM Education - Schéma CRM de Niveau Entreprise
-- Script idempotent : nettoie et recrée la structure complète.

-- 1. NETTOYAGE COMPLET
/* 
-- 🚨 ATTENTION : Les lignes ci-dessous EFFACENT toutes vos données. 
-- Ne les décommentez que si vous voulez réinitialiser complètement votre CRM.

DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS sequence_steps CASCADE;
DROP TABLE IF EXISTS sequences CASCADE;
DROP TABLE IF EXISTS messaging_templates CASCADE;
DROP TABLE IF EXISTS lead_documents CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS lead_interactions CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS lead_statuses CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
*/


-- 2. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. ORGANISATIONS & TENANTS
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RÉFÉRENTIEL DES STATUTS (Pipeline)
CREATE TABLE lead_statuses (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE
);

-- 5. PROFILS UTILISATEURS (Conseillers)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT CHECK (role IN ('admin', 'agent')),
    email TEXT,
    capacity_weight INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CAMPAGNES MARKETING
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source TEXT, -- TikTok, FB, Google, Salon
    start_date TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PROSPECTS (LEADS)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status_id TEXT REFERENCES lead_statuses(id) DEFAULT 'nouveau',
    
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT NOT NULL,
    city TEXT,
    country TEXT DEFAULT 'Sénégal',
    field_of_interest TEXT,
    study_level TEXT,
    
    score INTEGER DEFAULT 0,
    notes TEXT,
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. GESTION DES DOCUMENTS (Dossiers étudiants)
CREATE TABLE lead_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- ex: 'CV', 'Relevé de notes Master'
    file_path TEXT NOT NULL, -- URL vers Supabase Storage
    type TEXT, -- type mine
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. MESSAGERIE : TEMPLATES
CREATE TABLE messaging_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- avec placeholders {{firstName}}
    category TEXT CHECK (category IN ('whatsapp', 'email', 'sms')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AUTOMATISATION : SÉQUENCES
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,
    template_id UUID REFERENCES messaging_templates(id) ON DELETE SET NULL,
    delay_days INTEGER DEFAULT 0, -- Attendre X jours avant l'envoi
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. RENDEZ-VOUS & AGENDAS
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    meeting_link TEXT, -- Zoom, Google Meet
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. INTERACTIONS & TÂCHES
CREATE TABLE lead_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id),
    type TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id),
    title TEXT NOT NULL,
    due_date TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. NOTIFICATIONS SYSTÈME
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT, -- Lien vers le prospect ou la tâche
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. INVITATIONS (Pour l'onboarding de l'équipe)
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'agent')),
    token TEXT UNIQUE NOT NULL, -- Pour le lien d'activation
    invited_by UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. AUDIT
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INITIALISATION DES DONNÉES
INSERT INTO lead_statuses (id, label, color, is_default, sort_order) VALUES
('nouveau', 'Nouveau', '#6366f1', true, 1),
('tentative_1', 'Tentative 1', '#f59e0b', false, 2),
('contacte', 'Contacté', '#10b981', false, 3),
('interesse', 'Intéressé', '#8b5cf6', false, 4),
('dossier_envoye', 'Dossier Envoyé', '#3b82f6', false, 5),
('inscrit', 'Inscrit', '#22c55e', false, 6),
('perdu', 'Perdu', '#ef4444', false, 7),
('faux_numero', 'Faux Numéro', '#000000', false, 8)
ON CONFLICT (id) DO NOTHING;

-- 16. SECURITE (Fonctions d'aide)
CREATE OR REPLACE FUNCTION get_my_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT (role = 'admin') FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Activation RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- POLITIQUES BYPASS (ACCÈS TOTAL POUR DEV)
CREATE POLICY "org_full_access" ON organizations FOR ALL USING (true);
CREATE POLICY "profile_full_access" ON profiles FOR ALL USING (true);
CREATE POLICY "leads_full_access" ON leads FOR ALL USING (true);
CREATE POLICY "campaigns_full_access" ON campaigns FOR ALL USING (true);
CREATE POLICY "statuses_full_access" ON lead_statuses FOR ALL USING (true);
CREATE POLICY "interactions_full_access" ON lead_interactions FOR ALL USING (true);
CREATE POLICY "tasks_full_access" ON tasks FOR ALL USING (true);
CREATE POLICY "docs_full_access" ON lead_documents FOR ALL USING (true);
CREATE POLICY "templates_full_access" ON messaging_templates FOR ALL USING (true);
CREATE POLICY "sequences_full_access" ON sequences FOR ALL USING (true);
CREATE POLICY "steps_full_access" ON sequence_steps FOR ALL USING (true);
CREATE POLICY "invitations_full_access" ON invitations FOR ALL USING (true);
CREATE POLICY "notifications_full_access" ON notifications FOR ALL USING (true);
CREATE POLICY "audit_full_access" ON audit_logs FOR ALL USING (true);
CREATE POLICY "appointments_full_access" ON appointments FOR ALL USING (true);

-- ==========================================
-- INITIALISATION POUR LE MODE BYPASS
-- ==========================================

-- Création de l'organisation par défaut
INSERT INTO organizations (id, name, domain) 
VALUES ('00000000-0000-0000-0000-000000000000', 'ESCEN CRM', 'escen.university')
ON CONFLICT (id) DO NOTHING;

-- Création d'une campagne par défaut
INSERT INTO campaigns (id, name, source, organization_id, start_date)
VALUES ('c0000000-0000-0000-0000-000000000000', 'Campagne de Test', 'Facebook', '00000000-0000-0000-0000-000000000000', NOW())
ON CONFLICT (id) DO NOTHING;

-- Création du profil admin bypass (C'est l'étape manquante qui causait les erreurs d'insertion !)
INSERT INTO profiles (id, organization_id, full_name, role, email, capacity_weight, is_active)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Administrateur Démo', 'admin', 'admin@elitecrm.dev', 1, true)
ON CONFLICT (id) DO NOTHING;

-- Création des statuts par défaut (doublon de sécurité pour l'organisation bypass)
INSERT INTO lead_statuses (id, label, color, is_default, sort_order, organization_id)
VALUES 
    ('nouveau', 'Nouveau', '#6366f1', true, 1, '00000000-0000-0000-0000-000000000000'),
    ('contacte', 'Contacté', '#10b981', false, 2, '00000000-0000-0000-0000-000000000000'),
    ('interesse', 'Intéressé', '#8b5cf6', false, 3, '00000000-0000-0000-0000-000000000000'),
    ('inscrit', 'Inscrit', '#22c55e', false, 4, '00000000-0000-0000-0000-000000000000'),
    ('perdu', 'Perdu', '#ef4444', false, 5, '00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO NOTHING;
