
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function migrate() {
    const OLD = '9115fb54-1b00-444e-bb78-c31dc30630b5';
    const NEW = 'f692a874-5eb9-408c-b021-d1be8e05cb6b';

    console.log('--- MISSION : MIGRATION AMAH V3 ---');
    
    // 1. Mise à jour des leads
    const { data: leads, error: e1 } = await supabase.from('leads').update({ agent_id: NEW }).eq('agent_id', OLD).select();
    if (e1) console.error('E1:', e1.message);
    else console.log(`✅ ${leads?.length || 0} LEADS transférés !`);

    // 2. Mise à jour des interactions
    const { data: notes, error: e2 } = await supabase.from('lead_interactions').update({ agent_id: NEW }).eq('agent_id', OLD).select();
    if (e2) console.error('E2:', e2.message);
    else console.log(`✅ ${notes?.length || 0} NOTES transférées !`);

    // 3. Suppression de l'ancien profil (Doublon inutile)
    const { error: e3 } = await supabase.from('profiles').delete().eq('id', OLD);
    if (e3) console.error('E3:', e3.message);
    else console.log('✅ Ancien profil Doublon effacé !');
}

migrate();
