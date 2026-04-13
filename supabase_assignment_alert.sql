-- 1. TRIGGER POUR LES NOUVELLES ASSIGNATIONS DE PROSPECTS
CREATE OR REPLACE FUNCTION public.notify_agent_assignment()
RETURNS TRIGGER AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    agent_record RECORD;
    email_body TEXT;
BEGIN
    -- On ne déclenche que si l'agent a changé et qu'il n'est pas NULL
    IF (TG_OP = 'UPDATE' AND NEW.agent_id IS DISTINCT FROM OLD.agent_id AND NEW.agent_id IS NOT NULL) OR
       (TG_OP = 'INSERT' AND NEW.agent_id IS NOT NULL) THEN
        
        -- Récupérer l'Email de l'agent
        SELECT full_name, email INTO agent_record FROM public.profiles WHERE id = NEW.agent_id;

        IF agent_record.email IS NOT NULL THEN
            email_body := format('
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eee; border-radius: 12px; padding: 30px;">
                    <h2 style="color: #6366f1;">🚀 Nouveau Prospect Assigné !</h2>
                    <p>Bonjour %s,</p>
                    <p>Un nouveau prospect vient de vous être attribué dans le CRM Elite.</p>
                    <div style="background: #f0f7ff; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #6366f1;">
                        <p style="margin: 0;"><strong>Identité :</strong> %s %s</p>
                        <p style="margin: 5px 0;"><strong>Filière :</strong> %s</p>
                    </div>
                    <p>Connectez-vous vite pour prendre contact avec lui !</p>
                    <a href="https://escen.university" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Voir mon Dashboard</a>
                </div>
            ', agent_record.full_name, NEW.first_name, COALESCE(NEW.last_name, ''), COALESCE(NEW.field_of_interest, 'Non spécifiée'));

            -- ENVOI REQUÊTE À RESEND
            PERFORM net.http_post(
                url := 'https://api.resend.com/emails',
                headers := jsonb_build_object(
                    'Authorization', 'Bearer ' || resend_api_key,
                    'Content-Type', 'application/json'
                ),
                body := jsonb_build_object(
                    'from', 'EliteCRM ESCEN <contact@escen.university>',
                    'to', ARRAY[agent_record.email],
                    'subject', '🔔 Nouveau prospect à traiter : ' || NEW.first_name || ' ' || COALESCE(NEW.last_name, ''),
                    'html', email_body
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ACTIVER LE TRIGGER
DROP TRIGGER IF EXISTS on_lead_assigned ON public.leads;
CREATE TRIGGER on_lead_assigned
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.notify_agent_assignment();
