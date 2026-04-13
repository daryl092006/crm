
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const DEFAULT_ID = '00000000-0000-0000-0000-000000000000';
const AMAH_EMAIL = 'a.amah@escen.university';
const AMAH_PASS = 'AmahEscen2026!'; // À changer après la première connexion !

async function migrateAmah() {
    console.log('--- Migration pour Amah ---');
    
    // 1. Chercher Amah dans les profils existants
    const { data: profile } = await supabase.from('profiles').select('*').ilike('full_name', '%amah%').maybeSingle();
    
    if (profile) {
        console.log('Amah trouvé avec l\'identifiant :', profile.id);
    } else {
        console.log('Amah n\'a pas de profil dédié, nous allons migrer le profil par défaut.');
    }

    // 2. Créer l'utilisateur dans l'Auth Supabase
    // Note : On utilise signUp. Si l'admin a déjà cet email, ça retournera une erreur gérée.
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: AMAH_EMAIL,
        password: AMAH_PASS,
        options: { data: { full_name: 'Amah - Conseiller', role: 'admin' } }
    });

    if (authError) {
        console.error('Erreur Auth (Peut-être existe-t-il déjà ?) :', authError.message);
    } else {
        const newId = authData.user.id;
        console.log('Compte Auth créé pour Amah avec l\'ID :', newId);
        
        // 3. Migration des leads et interactions vers le nouvel ID
        console.log('Migration des prospects...');
        const { error: leadsErr } = await supabase.from('leads').update({ agent_id: newId }).eq('agent_id', DEFAULT_ID);
        const { error: interactionErr } = await supabase.from('lead_interactions').update({ agent_id: newId }).eq('agent_id', DEFAULT_ID);
        
        if (!leadsErr && !interactionErr) {
            console.log('Transfert des données réussi !');
            // Créer/Mettre à jour son profil avec son rôle d'administrateur pour qu'il puisse gérer son espace
            await supabase.from('profiles').upsert({ id: newId, organization_id: DEFAULT_ID, full_name: 'Amah', email: AMAH_EMAIL, role: 'admin' });
        }
    }
}

migrateAmah();
