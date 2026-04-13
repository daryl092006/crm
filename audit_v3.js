
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- REVELATION TOTALE ESCEN CRM ---');
    
    // 1. Profil Amah
    const { data: p } = await supabase.from('profiles').select('*').eq('email', 'a.amah@escen.university').maybeSingle();
    console.log('Fiche Amah ID: [' + (p?.id || 'Inconnu') + '] Role: ' + (p?.role || '?') + ' Org: ' + (p?.organization_id || '?'));

    // 2. Compte de prospects en base
    const { data: countData } = await supabase.from('leads').select('id, agent_id, organization_id');
    console.log(`Nombre total de prospects en base : ${countData?.length || 0}`);

    if (countData && countData.length > 0) {
        const first = countData[0];
        console.log(`Exemple Prospect rattaché à Agent ID : [${first.agent_id}] et Org ID : [${first.organization_id}]`);
        
        // 3. Vérification de la correspondance
        if (p && first.agent_id === p.id) {
            console.log('✅ Match ID Agent !');
        } else {
            console.log('❌ MISMATCH ID Agent !');
        }

        if (p && first.organization_id === p.organization_id) {
            console.log('✅ Match ID Org !');
        } else {
            console.log('❌ MISMATCH ID Org !');
        }
    }
}

check();
