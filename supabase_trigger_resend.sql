-- 1. ACTIVER LE MOTEUR D'ENVOI HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. CRÉER LA FONCTION DE LIVRAISON DES EMAILS
CREATE OR REPLACE FUNCTION public.handle_new_agent_email()
RETURNS TRIGGER AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    email_body TEXT;
BEGIN
    -- Uniquement si c'est un agent
    IF NEW.role = 'agent' THEN
        
        email_body := format('
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eee; border-radius: 12px; padding: 30px;">
                <h1 style="color: #6366f1; font-size: 24px;">Bienvenue, %s !</h1>
                <p>Votre compte conseiller ESCEN a été créé avec succès par l''administration.</p>
                <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <p style="margin-top: 0;"><strong>Vos accès EliteCRM :</strong></p>
                    <p style="margin-bottom: 5px;">Identifiant : <b>%s</b></p>
                    <p style="margin-top: 0;">Mot de passe : <i>(Celui défini par l''administrateur)</i></p>
                </div>
                <p>Vous pouvez dès à présent vous connecter pour gérer vos prospects.</p>
                <a href="https://escen.university" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Accéder au CRM</a>
                <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999;">Support Informatique ESCEN.</p>
            </div>
        ', NEW.full_name, NEW.email);

        -- ENVOI REQUÊTE À RESEND VIA PG_NET
        PERFORM net.http_post(
            url := 'https://api.resend.com/emails',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || resend_api_key,
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'from', 'Support Informatique ESCEN <support.informatique@escen.university>',
                'to', ARRAY[NEW.email],
                'subject', '🎓 Vos Accès EliteCRM - Bienvenue dans l''Équipe',
                'html', email_body
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ACTIVER LE TRIGGER AU MOMENT DE LA CRÉATION
DROP TRIGGER IF EXISTS on_new_agent_created ON public.profiles;
CREATE TRIGGER on_new_agent_created
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_agent_email();
