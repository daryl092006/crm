
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- SCANNER DE SÉCURITÉ ESCEN CRM ---');
    
    // 1. Lister tous les leads
    const { data: leads } = await supabase.from('leads').select('organization_id, agent_id').limit(1);
    console.log('Exemple Lead Org:', leads?.[0]?.organization_id);

    // 2. Profil d'Amah
    const { data: p } = await supabase.from('profiles').select('*').eq('email', 'a.amah@escen.university').maybeSingle();
    console.log('Amah Org:', p?.organization_id);
}

check();
