-- # Système de Notifications Pro pour EliteCRM
-- Ce script active le temps réel et les triggers automatiques.

-- 1. ACTIVATION DU TEMPS RÉEL (Version compatible)
-- Cela permet à la bulle dans l'interface de s'allumer instantanément.
BEGIN;
  DO $$ 
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION 
    WHEN duplicate_object THEN NULL; -- On ignore si elle est déjà présente
  END $$;
COMMIT;

-- 2. TRIGGER : NOTIFICATION À L'ASSIGNATION D'UN LEAD
-- Déclenché quand un prospect est assigné ou réassigné.
CREATE OR REPLACE FUNCTION public.fn_notify_lead_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.agent_id IS NOT NULL) AND (OLD.agent_id IS NULL OR NEW.agent_id != OLD.agent_id) THEN
        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (
            NEW.agent_id,
            '🚀 Nouveau Prospect !',
            NEW.first_name || ' ' || COALESCE(NEW.last_name, '') || ' vous a été assigné.',
            'leads' -- Lien vers l'onglet des leads
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_lead_assignment ON public.leads;
CREATE TRIGGER tr_notify_lead_assignment
AFTER INSERT OR UPDATE OF agent_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_lead_assignment();

-- 3. TRIGGER : NOTIFICATION TÂCHE ASSIGNÉE
-- Déclenché quand une nouvelle tâche est créée pour un agent.
CREATE OR REPLACE FUNCTION public.fn_notify_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.agent_id IS NOT NULL) THEN
        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (
            NEW.agent_id,
            '📅 Nouvelle Tâche',
            'Sujet : ' || NEW.title || '.',
            'dashboard' -- Lien vers le dashboard (où se trouvent souvent les tâches)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_task_assignment ON public.tasks;
CREATE TRIGGER tr_notify_task_assignment
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_task_assignment();

-- 4. TRIGGER : NOTIFICATION DE BIENVENUE (Pour les nouveaux agents)
CREATE OR REPLACE FUNCTION public.fn_notify_welcome_agent()
RETURNS TRIGGER AS $$
BEGIN
    -- On cherche l'ID dans auth.users si NEW.id est un UUID valide
    IF (NEW.role = 'agent' AND NEW.is_active = true) THEN
        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (
            NEW.id,
            '🎓 Bienvenue chez ESCEN !',
            'Votre compte est prêt. Commencez par configurer votre profil.',
            'profile'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_welcome_agent ON public.profiles;
CREATE TRIGGER tr_notify_welcome_agent
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_notify_welcome_agent();
