
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- AUDIT DES LIAISONS ESCEN CRM ---');
    
    // 1. Chercher le profil d'Amah
    const { data: p } = await supabase
        .from('profiles')
        .select('full_name, organization_id')
        .eq('email', 'a.amah@escen.university')
        .maybeSingle();

    if (p) {
        console.log(`Conseiller : ${p.full_name}`);
        
        // 2. Chercher son organisation
        const { data: o } = await supabase
            .from('organizations')
            .select('name, domain')
            .eq('id', p.organization_id)
            .maybeSingle();

        if (o) {
            console.log(`✅ Organisation officielle : ${o.name} (${o.domain})`);
        } else {
            console.log(`⚠️ Alerte : Organisation ID ${p.organization_id} INTROUVABLE !`);
        }
    } else {
        console.log('⚠️ Aucun profil trouvé avec l\'email a.amah@escen.university');
    }
}

check();
