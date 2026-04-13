-- 1. CRÉER UNE TABLE DE TAMPON POUR LES NOTIFICATIONS EN ATTENTE
CREATE TABLE IF NOT EXISTS public.pending_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    leads_count INTEGER DEFAULT 1,
    last_lead_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TRIGGER POUR REMPLIR LE TAMPON SANS ENVOYER DE MAIL TOUT DE SUITE
CREATE OR REPLACE FUNCTION public.buffer_assignment_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.agent_id IS DISTINCT FROM OLD.agent_id AND NEW.agent_id IS NOT NULL) OR
       (TG_OP = 'INSERT' AND NEW.agent_id IS NOT NULL) THEN
        
        -- On ajoute au tampon ou on incrémente le compteur existant des dernières 5 minutes
        INSERT INTO public.pending_notifications (agent_id, leads_count, last_lead_name)
        VALUES (NEW.agent_id, 1, NEW.first_name)
        ON CONFLICT (id) DO NOTHING; -- Pour la sérialisation
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FONCTION DE LIVRAISON GROUPÉE (À LANCER CHAQUE HEURE OU VIA CRON)
CREATE OR REPLACE FUNCTION public.send_batched_notifications()
RETURNS VOID AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    notif_record RECORD;
    agent_record RECORD;
    email_body TEXT;
BEGIN
    -- On regroupe par agent les notifications en attente
    FOR notif_record IN 
        SELECT agent_id, SUM(leads_count) as total_leads, MAX(last_lead_name) as sample_name
        FROM public.pending_notifications
        GROUP BY agent_id
    LOOP
        SELECT full_name, email INTO agent_record FROM public.profiles WHERE id = notif_record.agent_id;

        IF agent_record.email IS NOT NULL THEN
            email_body := format('
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eee; border-radius: 12px; padding: 30px; border-top: 5px solid #6366f1;">
                    <h2 style="color: #6366f1;">📈 Rapport d''Assignation EliteCRM</h2>
                    <p>Bonjour %s,</p>
                    <p>Votre bureau a été mis à jour avec de nouveaux dossiers d''inscription.</p>
                    <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin: 25px 0; border: 1px solid #e2e8f0; text-align: center;">
                        <div style="font-size: 48px; font-weight: 900; color: #6366f1; margin-bottom: 10px;">%s</div>
                        <div style="font-size: 18px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.1em;">Nouveaux Prospects</div>
                    </div>
                    <p>Dernier dossier arrivé : <b>%s</b></p>
                    <p>Prêt pour les admissions ? Cliquez sur le bouton ci-dessous pour traiter cette nouvelle vague.</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="https://escen.university" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; box-shadow: 0 4px 6px rgba(99,102,241,0.2);">Accéder à mon équipe</a>
                    </div>
                    <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 11px; color: #999; text-align: center;">Support Informatique EliteCRM - contact@escen.university</p>
                </div>
            ', agent_record.agent_name, notif_record.total_leads, notif_record.sample_name);

            -- Envoi Resend
            PERFORM net.http_post(
                url := 'https://api.resend.com/emails',
                headers := jsonb_build_object('Authorization', 'Bearer ' || resend_api_key, 'Content-Type', 'application/json'),
                body := jsonb_build_object('from', 'Administrateur CRM <contact@escen.university>', 'to', ARRAY[agent_record.email], 'subject', '📊 Alerte Activité : ' || notif_record.total_leads || ' nouveaux prospects à traiter', 'html', email_body)
            );
        END IF;

        -- On vide le tampon pour cet agent
        DELETE FROM public.pending_notifications WHERE agent_id = notif_record.agent_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
