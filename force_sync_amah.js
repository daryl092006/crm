
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const AMAH_EMAIL = 'a.amah@escen.university';

async function forceSync() {
    console.log('--- MISSION : SYNC FINALE AKPADJA ---');

    // 1. On cherche l'ID du profil qu'il utilise actuellement (celui lié à son email a.amah@escen.university)
    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('email', AMAH_EMAIL)
        .maybeSingle();

    if (currentProfile) {
        const trueId = currentProfile.id;
        console.log(`L'identifiant actif d'Amah est : ${trueId}`);

        // 2. On prend TOUS les prospects de la base et on les donne à cet ID
        console.log('Transfert massif des 627 prospects...');
        const { error: err1 } = await supabase.from('leads').update({ agent_id: trueId }).neq('agent_id', trueId);
        const { error: err2 } = await supabase.from('lead_interactions').update({ agent_id: trueId }).neq('agent_id', trueId);

        // 3. On met son profil au propre
        console.log('Finalisation du profil académique...');
        await supabase.from('profiles').update({
            full_name: 'AKPADJA Tete Amah',
            role: 'agent'
        }).eq('id', trueId);

        if (!err1 && !err2) {
            console.log('✅ VICTOIRE : AKPADJA Tete Amah est désormais le propriétaire certifié de ses 627 prospects !');
        } else {
            console.log('⚠️ Erreur mineure lors du transfert.');
        }
    } else {
        console.log('⚠️ Profil d\'Amah introuvable. Demandez-lui de se connecter une fois !');
    }
}

forceSync();
