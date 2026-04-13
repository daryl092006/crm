
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- INSPECTION PROFIL BYPASS ---');
    const { data: p } = await supabase.from('profiles').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
    console.log(JSON.stringify(p));
}

check();
