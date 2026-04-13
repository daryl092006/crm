-- 1. AJOUTER LA COLONNE DE CONTRÔLE DE SÉCURITÉ
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;

-- 2. METTRE À JOUR LE FILTRAGE DES EMAILS (TRIGGER)
CREATE OR REPLACE FUNCTION public.handle_new_agent_email()
RETURNS TRIGGER AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    default_password TEXT := 'Escen2026!'; -- MOT DE PASSE PAR DÉFAUT
    email_body TEXT;
BEGIN
    -- Uniquement si c'est un agent
    IF NEW.role = 'agent' THEN
        
        email_body := format('
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eee; border-radius: 12px; padding: 30px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="https://escen.university/logo.png" alt="ESCEN" style="max-width: 150px;">
                </div>
                <h1 style="color: #6366f1; font-size: 24px; text-align: center;">Bienvenue dans l''Équipe, %s !</h1>
                <p>Votre compte conseiller EliteCRM a été activé. Vous faites désormais partie du dispositif d''accompagnement des étudiants.</p>
                
                <div style="background: #fdf2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <p style="margin-top: 0; color: #991b1b;"><strong>🔒 ACCÈS DE SÉCURITÉ TEMPORAIRES :</strong></p>
                    <p style="margin-bottom: 5px;">Identifiant : <b>%s</b></p>
                    <p style="margin-top: 0;">Mot de passe provisoire : <code style="background: #eee; padding: 2px 6px; border-radius: 4px;">%s</code></p>
                    <p style="font-size: 13px; color: #991b1b; margin-top: 10px;">⚠️ <b>IMPORTANT :</b> Pour des raisons de sécurité, vous serez invité à définir votre propre mot de passe personnel dès votre première connexion.</p>
                </div>
                
                <p>Prêt à piloter vos campagnes ? Cliquez sur le bouton ci-dessous pour commencer :</p>
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://escen.university" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2);">Activer mon compte</a>
                </div>
                
                <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                <p style="font-size: 11px; color: #999; text-align: center;">Support Informatique EliteCRM - ESCEN University</p>
            </div>
        ', NEW.full_name, NEW.email, default_password);

        -- ENVOI REQUÊTE À RESEND
        PERFORM net.http_post(
            url := 'https://api.resend.com/emails',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || resend_api_key,
                'Content-Type': 'application/json'
            ),
            body := jsonb_build_object(
                'from', 'Support Informatique ESCEN <support.informatique@escen.university>',
                'to', ARRAY[NEW.email],
                'subject', '🎓 Action Requise : Vos Accès EliteCRM - ESCEN',
                'html', email_body
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
