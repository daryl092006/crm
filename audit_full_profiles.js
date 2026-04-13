
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- REPERTOIRE COMPLET DES PROFILS ---');
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) {
        profiles.forEach(p => {
            console.log(`[${p.full_name}] Email: ${p.email} | Rôle: ${p.role} | ID: ${p.id}`);
        });
    } else {
        console.log('Aucun profil en base.');
    }
}

check();
