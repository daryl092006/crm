-- 1. S'ASSURER QUE LA COLONNE EXISTE TOUJOURS
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;

-- 2. METTRE À JOUR LE FILTRAGE AVEC GÉNÉRATEUR ALÉATOIRE
CREATE OR REPLACE FUNCTION public.handle_new_agent_email()
RETURNS TRIGGER AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    temp_password TEXT; -- LE CODE AUTO-GÉNÉRÉ
    email_body TEXT;
BEGIN
    -- Uniquement si c'est un agent
    IF NEW.role = 'agent' THEN
        
        -- GÉNÉRATION D'UN CODE ALÉATOIRE DE 6 CARACTÈRES (ex: orrh23)
        temp_password := substring(md5(random()::text) from 1 for 6);

        email_body := format('
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eee; border-radius: 12px; padding: 30px;">
                <h1 style="color: #6366f1; font-size: 24px; text-align: center;">Bienvenue dans l''Équipe, %s !</h1>
                <p>Votre compte conseiller EliteCRM a été activé avec succès.</p>
                
                <div style="background: #fdf2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <p style="margin-top: 0; color: #991b1b;"><strong>🔒 VOS ACCÈS DE SÉCURITÉ PERSONNELS :</strong></p>
                    <p style="margin-bottom: 5px;">Identifiant : <b>%s</b></p>
                    <p style="margin-top: 0;">Mot de passe provisoire : <code style="background: #eee; padding: 4px 8px; border-radius: 6px; font-weight: bold; border: 1px solid #ddd;">%s</code></p>
                    <p style="font-size: 13px; color: #991b1b; margin-top: 15px;">⚠️ <b>RAPPEL :</b> Vous devrez obligatoirement changer ce code par un mot de passe personnel dès votre première connexion.</p>
                </div>
                
                <p>Cliquez sur le bouton ci-dessous pour activer votre accès :</p>
                
                <div style="text-align: center; margin-top: 25px;">
                    <a href="https://escen.university" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Accéder au CRM</a>
                </div>
                
                <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                <p style="font-size: 11px; color: #999; text-align: center;">Support Informatique EliteCRM - ESCEN University</p>
            </div>
        ', NEW.full_name, NEW.email, temp_password);

        -- ENVOI REQUÊTE À RESEND
        PERFORM net.http_post(
            url := 'https://api.resend.com/emails',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || resend_api_key,
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'from', 'Support Informatique ESCEN <support.informatique@escen.university>',
                'to', ARRAY[NEW.email],
                'subject', '🎓 Vos Accès EliteCRM - ESCEN',
                'html', email_body
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
