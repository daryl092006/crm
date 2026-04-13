-- 1. FONCTION DE SCAN DES RAPPELS PROCHES (30 MIN)
CREATE OR REPLACE FUNCTION public.check_reminders_and_notify()
RETURNS VOID AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    reminder_record RECORD;
    email_body TEXT;
BEGIN
    -- On cherche les rendez-vous dont l'heure est dans environ 30 minutes
    -- et qui n'ont pas encore été notifiés (on peut ajouter une colonne is_notified_30m plus tard)
    FOR reminder_record IN 
        SELECT 
            ap.id,
            ap.title,
            ap.scheduled_at,
            p.email as agent_email,
            p.full_name as agent_name,
            l.first_name as lead_name,
            l.last_name as lead_last_name
        FROM public.appointments ap
        JOIN public.profiles p ON ap.agent_id = p.id
        JOIN public.leads l ON ap.lead_id = l.id
        WHERE ap.status = 'scheduled'
        AND ap.scheduled_at > NOW() 
        AND ap.scheduled_at <= NOW() + INTERVAL '30 minutes'
    LOOP
        
        email_body := format('
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eee; border-radius: 12px; padding: 30px; border-top: 5px solid #f59e0b;">
                <h2 style="color: #f59e0b;">⏳ ALERTE RAPPEL : J - 30 MIN !</h2>
                <p>Bonjour %s,</p>
                <p>Ceci est une notification prioritaire de la tour de contrôle EliteCRM.</p>
                <div style="background: #fffbeb; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #fde68a;">
                    <p style="margin: 0;"><strong>Objet :</strong> %s</p>
                    <p style="margin: 5px 0;"><strong>Prospect :</strong> %s %s</p>
                    <p style="margin: 0;"><strong>Heure :</strong> %s</p>
                </div>
                <p>Préparez vos dossiers, l''entretien commence bientôt !</p>
                <a href="https://escen.university" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Accéder à ma fiche prospect</a>
            </div>
        ', reminder_record.agent_name, reminder_record.title, reminder_record.lead_name, reminder_record.lead_last_name, to_char(reminder_record.scheduled_at, 'HH24:MI'));

        -- ENVOI REQUÊTE À RESEND
        PERFORM net.http_post(
            url := 'https://api.resend.com/emails',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || resend_api_key,
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'from', 'EliteCRM ESCEN <contact@escen.university>',
                'to', ARRAY[reminder_record.agent_email],
                'subject', '⏳ J-30m : Rappel d''entretien avec ' || reminder_record.lead_name,
                'html', email_body
            )
        );
        
        -- On évite de renvoyer le mail en boucle (On pourrait changer le statut ou flagger)
        -- UPDATE public.appointments SET status = 'notified' WHERE id = reminder_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
