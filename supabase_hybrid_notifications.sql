-- 1. MISE À JOUR DU TRIGGER D'ASSIGNATION POUR L'APP
CREATE OR REPLACE FUNCTION public.notify_agent_assignment()
RETURNS TRIGGER AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    agent_record RECORD;
    email_body TEXT;
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.agent_id IS DISTINCT FROM OLD.agent_id AND NEW.agent_id IS NOT NULL) OR
       (TG_OP = 'INSERT' AND NEW.agent_id IS NOT NULL) THEN
        
        SELECT full_name, email INTO agent_record FROM public.profiles WHERE id = NEW.agent_id;

        -- A. NOTIFICATION DANS L'APPLICATION (Bulle rouge)
        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (
            NEW.agent_id, 
            '🚀 Nouveau Prospect', 
            NEW.first_name || ' ' || COALESCE(NEW.last_name, '') || ' vous a été assigné.',
            'leads' -- On envoie vers l'onglet leads
        );

        -- B. NOTIFICATION PAR EMAIL (Resend)
        IF agent_record.email IS NOT NULL THEN
            email_body := format('<h2>🚀 Nouveau Prospect !</h2><p>Bonjour %s, un nouveau prospect vous a été attribué : %s %s.</p>', agent_record.full_name, NEW.first_name, COALESCE(NEW.last_name, ''));
            PERFORM net.http_post(
                url := 'https://api.resend.com/emails',
                headers := jsonb_build_object('Authorization', 'Bearer ' || resend_api_key, 'Content-Type', 'application/json'),
                body := jsonb_build_object('from', 'EliteCRM <contact@escen.university>', 'to', ARRAY[agent_record.email], 'subject', '🔔 Nouveau prospect assigné', 'html', email_body)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. MISE À JOUR DU SCAN DES RAPPELS (RDV) POUR L'APP
CREATE OR REPLACE FUNCTION public.check_reminders_and_notify()
RETURNS VOID AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    reminder_record RECORD;
BEGIN
    FOR reminder_record IN 
        SELECT ap.id, ap.title, ap.agent_id, p.email as agent_email, l.first_name as lead_name
        FROM public.appointments ap
        JOIN public.profiles p ON ap.agent_id = p.id
        JOIN public.leads l ON ap.lead_id = l.id
        WHERE ap.status = 'scheduled' AND ap.scheduled_at > NOW() AND ap.scheduled_at <= NOW() + INTERVAL '30 minutes'
    LOOP
        -- A. NOTIFICATION DANS L'APPLICATION
        INSERT INTO public.notifications (user_id, title, message)
        VALUES (reminder_record.agent_id, '⏳ Rappel imminent !', 'Votre RDV avec ' || reminder_record.lead_name || ' commence dans 30 min.');

        -- B. NOTIFICATION EMAIL
        PERFORM net.http_post(
            url := 'https://api.resend.com/emails',
            headers := jsonb_build_object('Authorization', 'Bearer ' || resend_api_key, 'Content-Type', 'application/json'),
            body := jsonb_build_object('from', 'EliteCRM <contact@escen.university>', 'to', ARRAY[reminder_record.agent_email], 'subject', '⏳ Rappel : Entretien dans 30min', 'html', '<p>Vérifiez votre dashboard !</p>')
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
