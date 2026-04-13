
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fix() {
    console.log('--- MISSION : AKPADJA Tete Amah ---');
    
    // On force le nom et le rôle pour son email officiel
    const { data, error } = await supabase
        .from('profiles')
        .update({ 
            full_name: 'AKPADJA Tete Amah', 
            role: 'agent' 
        })
        .eq('email', 'a.amah@escen.university');

    if (error) {
        console.error('Erreur technique :', error.message);
    } else {
        console.log('✅ Succès : AKPADJA Tete Amah est désormais configuré comme Conseiller !');
    }
}

fix();
