
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function list() {
    console.log('--- Répertoire Officiel ESCEN CRM ---');
    const { data: p } = await supabase.from('profiles').select('*');
    if (p) {
        p.forEach(profile => {
            console.log(`[👤 ${profile.full_name}] - Email: ${profile.email} - Rôle: ${profile.role} - ID: ${profile.id}`);
        });
    } else {
        console.log('Aucun profil trouvé.');
    }
}

list();
