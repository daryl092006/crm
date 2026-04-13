
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function merge() {
    console.log('--- Fusion des profils AKPADJA Tete Amah ---');
    
    // 1. On cherche le "Vrai" (celui qui a les prospects, probablement avec un ID qui ne matche pas son auth)
    const { data: real } = await supabase.from('profiles').select('*').ilike('full_name', '%AKPADJA%').maybeSingle();
    
    // 2. On cherche le "Nouveau" (celui qui a ses accès email a.amah@escen.university)
    const { data: nuovo } = await supabase.from('profiles').select('*').eq('full_name', 'Amah - Conseiller').maybeSingle();

    if (real && nuovo && real.id !== nuovo.id) {
        console.log('On fusionne le profil ' + real.full_name + ' avec le compte ' + nuovo.email);
        
        // A. On donne TOUS les prospects du "vrai" au "nouveau" (celui qui peut se connecter)
        console.log('Transfert des prospects...');
        await supabase.from('leads').update({ agent_id: nuovo.id }).eq('agent_id', real.id);
        await supabase.from('lead_interactions').update({ agent_id: nuovo.id }).eq('agent_id', real.id);
        
        // B. On supprime l'ancien "corps" d'AKPADJA (le profil orphelin)
        console.log('Suppression de l\'ancien profil...');
        await supabase.from('profiles').delete().eq('id', real.id);
        
        // C. On renomme le "nouveau" avec le nom complet prestigieux
        console.log('Mise à jour du nom officiel...');
        await supabase.from('profiles').update({ 
            full_name: 'AKPADJA Tete Amah',
            role: 'agent' 
        }).eq('id', nuovo.id);
        
        console.log('✅ Fusion réussie ! AKPADJA Tete Amah est désormais unique et connecté.');
    } else {
        console.log('La fusion n\'est pas possible ou déjà effectuée.');
    }
}

merge();
