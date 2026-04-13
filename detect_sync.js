
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function detect() {
    console.log('--- SCANNER DE SÉCURITÉ ESCEN CRM ---');
    
    // 1. Lister tous les prospects de la base (Vérification ultime)
    const { data: leads } = await supabase.from('leads').select('agent_id');
    const leadCount = leads?.length || 0;
    console.log(`Prospects totaux en base : ${leadCount}`);

    // 2. Compter les prospects par Agent ID
    const counts = {};
    leads?.forEach(l => counts[l.agent_id] = (counts[l.agent_id] || 0) + 1);
    console.log('Répartition en base :', JSON.stringify(counts));

    // 3. Lister les profils avec leurs IDs
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');
    console.log('Profils enregistrés :', JSON.stringify(profiles));
}

detect();
