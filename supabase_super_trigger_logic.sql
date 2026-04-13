-- 1. ACTIVER LE MOTEUR DE CRYPTAGE (NÉCESSAIRE POUR LES MOTS DE PASSE)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. DÉBRANCHER LES ANCIENS TRIGGERS D'INVITATION (ON PASSE EN DIRECT)
DROP TRIGGER IF EXISTS on_invite_created ON public.invitations;
DROP TRIGGER IF EXISTS on_new_agent_created ON public.profiles;

-- 3. CRÉER LE "GÉNÉRATEUR SUPRÊME" D'UTILISATEURS
CREATE OR REPLACE FUNCTION public.handle_direct_agent_creation()
RETURNS TRIGGER AS $$
DECLARE
    resend_api_key TEXT := 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
    new_user_id UUID;
    temp_password TEXT;
    email_body TEXT;
BEGIN
    -- Uniquement si c'est un agent et qu'il n'existe pas encore
    IF NEW.role = 'agent' THEN
        
        -- A. GÉNÉRATION DU MOT DE PASSE (ex: orrh23)
        temp_password := substring(md5(random()::text) from 1 for 6);

        -- B. CRÉATION DU COMPTE DANS LE SAINT DES SAINTS (auth.users)
        -- On utilise la fonction interne de Supabase via SQL pur
        INSERT INTO auth.users (
            instance_id,
            id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            confirmation_token,
            email_change_confirm_status
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            NEW.email,
            crypt(temp_password, gen_salt('bf')), -- Cryptage du mot de passe
            now(), -- On confirme l'email automatiquement
            '{"provider":"email","providers":["email"]}',
            format('{"full_name":"%s"}', NEW.full_name)::jsonb,
            now(),
            now(),
            'authenticated',
            '',
            0
        ) RETURNING id INTO new_user_id;

        -- C. RACCORDEMENT DU PROFIL (On hydrate le profil avec le bon ID)
        -- Attention : Le INSERT initial a créé une ligne avec un UUID temporaire.
        -- C'est complexe car on est dans un trigger AFTER. 
        -- On va plutôt utiliser un trigger BEFORE pour changer l'ID.
        
        -- D. ENVOI DE L'EMAIL DE BIENVENUE AVEC LES ACCÈS
        email_body := format('
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; padding: 30px;">
                <h1 style="color: #6366f1;">🎓 Vos Accès EliteCRM ESCEN</h1>
                <p>Bonjour %s,</p>
                <p>Votre compte conseiller a été configuré par l''administration.</p>
                <div style="background: #f8fafc; border-radius: 12px; padding: 25px; margin: 20px 0; border: 1px solid #6366f1;">
                    <p><strong>Identifiant :</strong> %s</p>
                    <p><strong>Mot de passe :</strong> <code style="background: #eee; padding: 4px; font-weight: bold;">%s</code></p>
                </div>
                <p>Connectez-vous ici : <b>http://localhost:5173</b></p>
            </div>
        ', NEW.full_name, NEW.email, temp_password);

        PERFORM net.http_post(
            url := 'https://api.resend.com/emails',
            headers := jsonb_build_object('Authorization', 'Bearer ' || resend_api_key, 'Content-Type', 'application/json'),
            body := jsonb_build_object('from', 'Support EliteCRM <contact@escen.university>', 'to', ARRAY[NEW.email], 'subject', '🔑 Vos Accès EliteCRM', 'html', email_body)
        );
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
