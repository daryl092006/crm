
-- # AUTO-ASSIGNATION DES PROSPECTS
-- Ce script permet de répartir équitablement les nouveaux prospects arrivant via API/Google Sheets

CREATE OR REPLACE FUNCTION public.auto_assign_lead()
RETURNS TRIGGER AS $$
DECLARE
    target_agent_id UUID;
BEGIN
    -- On n'intervient que si aucun agent n'est spécifié (cas des imports automatiques)
    IF NEW.agent_id IS NULL THEN
        
        -- On cherche l'agent (agent ou super_agent) actif de l'organisation
        -- qui possède actuellement le moins de prospects assignés.
        SELECT id INTO target_agent_id
        FROM public.profiles
        WHERE organization_id = NEW.organization_id 
          AND (role = 'agent' OR role = 'super_agent') 
          AND is_active = TRUE
        ORDER BY (
            SELECT count(*) 
            FROM public.leads 
            WHERE leads.agent_id = profiles.id
        ) ASC, random() -- En cas d'égalité, on prend au hasard
        LIMIT 1;

        -- On assigne l'agent trouvé
        NEW.agent_id := target_agent_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activation du trigger
DROP TRIGGER IF EXISTS on_lead_added_auto_assign ON public.leads;
CREATE TRIGGER on_lead_added_auto_assign
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_lead();
