
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fix() {
    const ADMIN_ID = '00000000-0000-0000-0000-000000000000';
    const EMAIL = 'darylggt23@gmail.com';

    console.log('--- MISSION : SÉCURISATION ADMIN ESCEN ---');
    const { error } = await supabase.from('profiles').update({ 
        email: EMAIL, 
        full_name: 'Direction ESCEN' 
    }).eq('id', ADMIN_ID);

    if (error) {
        console.error('Erreur:', error.message);
    } else {
        console.log('✅ Adresse Admin ESCEN mise à jour avec succès dans le registre !');
    }
}

fix();
