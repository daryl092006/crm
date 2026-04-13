
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function migrate() {
    const OLD = '9115fb54-1b00-444e-bb78-c31dc30630b5';
    const NEW = 'f692a874-5eb9-408c-b021-d1be8e05cb6b';

    console.log('--- MISSION : MIGRATION PAS À PAS ---');
    
    const { data: leads } = await supabase.from('leads').select('id, agent_id').eq('agent_id', OLD);
    console.log(`Tentative sur ${leads?.length || 0} prospects...`);

    if (leads) {
        for (const l of leads) {
            const { error } = await supabase.from('leads').update({ agent_id: NEW }).eq('id', l.id);
            if (error) {
                console.error(`Echec sur ${l.id} : ${error.message}`);
                break; // On arrête au premier crash pour analyser
            }
        }
    }
}

migrate();
