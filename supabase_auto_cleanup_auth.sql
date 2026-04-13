-- # EliteCRM - Nettoyage Automatique des Comptes Auth
-- Ce script permet de s'assurer que lorsqu'un agent est supprimé de la table 'profiles',
-- son compte d'authentification est aussi supprimé de 'auth.users'.

-- 1. Création de la fonction de nettoyage
CREATE OR REPLACE FUNCTION public.handle_delete_user_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- Suppression de l'utilisateur dans le schéma interne de Supabase
    -- SECURITY DEFINER permet d'outrepasser les restrictions de droits standard
    DELETE FROM auth.users WHERE id = OLD.id;
    
    -- Optionnel : Log de l'action
    RAISE NOTICE 'Utilisateur AUTH supprimé pour l''ID : %', OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Création du Trigger
DROP TRIGGER IF EXISTS on_profile_deleted ON public.profiles;
CREATE TRIGGER on_profile_deleted
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_delete_user_auth();

-- NOTE : Après avoir exécuté ce script dans votre SQL Editor Supabase, 
-- la suppression d'un conseiller dans l'interface supprimera aussi ses accès de connexion.
