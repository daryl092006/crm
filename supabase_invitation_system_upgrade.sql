-- 1. AJOUT DU NOM COMPLET DANS LES INVITATIONS
ALTER TABLE public.invitations 
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. DÉBRANCHER LES ANCIENS TRIGGERS
DROP TRIGGER IF EXISTS on_new_agent_created ON public.profiles;

-- 3. CRÉER LE FACTEUR D'INVITATION (DÉPART IMMÉDIAT)
CREATE OR REPLACE FUNCTION public.handle_invite_email()
RETURNS TRIGGER AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    activation_link TEXT;
    email_body TEXT;
BEGIN
    -- Le lien pointe vers ton application (on peut l'adapter selon ton domaine réel)
    activation_link := 'https://escen.university/activate?token=' || NEW.token;

    email_body := format('
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; padding: 30px;">
            <h1 style="color: #6366f1;">🎓 Bienvenue dans l''Équipe EliteCRM - ESCEN</h1>
            <p>Bonjour %s,</p>
            <p>L''administration ESCEN vous a invité à rejoindre le dispositif de pilotage du recrutement.</p>
            <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin: 25px 0; text-align: center; border: 1px solid #e2e8f0;">
                <p style="margin-bottom: 20px;">Veuillez activer votre accès pour configurer vos identifiants conseiller.</p>
                <a href="%s" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(99,102,241,0.2);">ACTIVER MON COMPTE</a>
            </div>
            <p style="color: #64748b; font-size: 13px;">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur : <br>%s</p>
            <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">Support Informatique ESCEN CRM - contact@escen.university</p>
        </div>
    ', COALESCE(NEW.full_name, 'Conseiller'), activation_link, activation_link);

    -- ENVOI REQUÊTE À RESEND
    PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || resend_api_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object(
            'from', 'Support Informatique ESCEN <contact@escen.university>',
            'to', ARRAY[NEW.email],
            'subject', '🎓 Activation de vos accès EliteCRM - ESCEN',
            'html', email_body
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ACTIVER LE TRIGGER AU MOMENT DE L'INVITATION
DROP TRIGGER IF EXISTS on_invite_created ON public.invitations;
CREATE TRIGGER on_invite_created
AFTER INSERT ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.handle_invite_email();
