
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- REVELATION FINALE : AKPADJA Tete Amah ---');
    
    // 1. Profil exact
    const { data: p } = await supabase.from('profiles').select('*').eq('email', 'a.amah@escen.university').maybeSingle();
    console.log('Fiche Profil :', JSON.stringify(p));

    // 2. Prospects exacts
    const { data: leads } = await supabase.from('leads').select('id, agent_id, organization_id').limit(5);
    console.log('Exemples de Prospects :', JSON.stringify(leads));
}

check();
