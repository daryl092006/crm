
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const AMAH_FULLNAME = 'AKPADJA Tete Amah';
const AMAH_EMAIL = 'a.amah@escen.university';
const AMAH_PASS = 'AmahEscen2026!'; // À lui donner dès que c'est fini !

async function setupAmah() {
    console.log('--- Système de gestion AKPADJA Tete Amah ---');

    // 1. Chercher son profil par nom (Il est probablement sous l'ID par défaut)
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%AKPADJA%')
        .maybeSingle();

    if (profile) {
        console.log('Profil de AKPADJA Tete Amah identifié avec l\'ID :', profile.id);
        
        // 2. Tenter de lui créer ses identifiants auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: AMAH_EMAIL,
            password: AMAH_PASS,
            options: { data: { full_name: AMAH_FULLNAME, role: 'agent' } }
        });

        if (authError) {
            console.warn('Erreur ou compte déjà existant :', authError.message);
        } else {
            console.log('Accès Supabase Auth créé avec succès.');
        }

        // On s'assure d'une chose : si on ne peut pas changer son ID Auth maintenant, 
        // ce n'est pas grave car j'ai déjà un système de migration automatique 
        // prêt dans App.tsx qui s'activera lors de sa première connexion !
    } else {
        console.log('Aucun profil AKPADJA trouvé : je vais créer un nouveau profil pour lui avec le bon rôle.');
        // Créer un profil ex-nihilo s'il n'existe plus
        const { data: authData } = await supabase.auth.signUp({
            email: AMAH_EMAIL,
            password: AMAH_PASS,
            options: { data: { full_name: AMAH_FULLNAME, role: 'agent' } }
        });
        
        if (authData?.user) {
            await supabase.from('profiles').insert({
                id: authData.user.id,
                full_name: AMAH_FULLNAME,
                email: AMAH_EMAIL,
                role: 'agent',
                organization_id: '00000000-0000-0000-0000-000000000000'
            });
            console.log('Profil AKPADJA créé avec succès.');
        }
    }
}

setupAmah();
