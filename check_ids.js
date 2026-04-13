
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- AUDIT CHIRURGICAL DES IDENTIFIANTS ---');
    
    // Un seul prospect
    const { data: leads } = await supabase.from('leads').select('agent_id').limit(1);
    const leadAgentId = leads?.[0]?.agent_id;
    console.log(`- Prospect attaché à l'ID : [${leadAgentId}]`);

    // Le profil d'Amah
    const { data: p } = await supabase.from('profiles').select('id, full_name').eq('email', 'a.amah@escen.university').maybeSingle();
    console.log(`- Profil d'Amah utilise l'ID : [${p?.id}]`);
}

check();
