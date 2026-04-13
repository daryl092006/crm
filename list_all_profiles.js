
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- REPERTOIRE DES PROFILS ESCEN CRM ---');
    const { data } = await supabase.from('profiles').select('id, email, full_name, role');
    if (data) {
        console.log(JSON.stringify(data));
    }
}

check();
