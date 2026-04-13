
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const TRUE_AMAH_ID = 'a83163f2-6cf2-4085-a92b-343d9e39f111';

async function finalize() {
    console.log('--- Finalisation des données pour AKPADJA Tete Amah ---');
    
    // 1. On rattache TOUS les prospects à son identifiant
    const { error: leadsErr } = await supabase
        .from('leads')
        .update({ agent_id: TRUE_AMAH_ID })
        .neq('agent_id', TRUE_AMAH_ID);
    
    // 2. On rattache TOUTES les interactions à son identifiant
    const { error: intErr } = await supabase
        .from('lead_interactions')
        .update({ agent_id: TRUE_AMAH_ID })
        .neq('agent_id', TRUE_AMAH_ID);

    if (leadsErr || intErr) {
        console.error('Une petite erreur s\'est glissée :', leadsErr?.message || intErr?.message);
    } else {
        console.log('✅ Succès : Tous les prospects sont maintenant la propriété de ce conseiller !');
    }
}

finalize();
