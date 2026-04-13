
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function count() {
    console.log('--- RECENSEMENT TOTAL DES PROFILS ---');
    const { data } = await supabase.from('profiles').select('id, full_name, email, role');
    if (data) {
        console.log(`Total en base : ${data.length}`);
        data.forEach(p => {
            console.log(`- [${p.id}] ${p.full_name} (${p.email}) -> Rôle: ${p.role}`);
        });
    }
}

count();
