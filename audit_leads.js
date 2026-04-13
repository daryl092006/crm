
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function audit() {
    console.log('--- RECAPITULATIF PROSPECTS ESCEN CRM ---');
    const { data: leads } = await supabase.from('leads').select('agent_id');
    
    if (leads && leads.length > 0) {
        console.log(`Total prospects en base : ${leads.length}`);
        
        const counts = {};
        leads.forEach(l => {
            counts[l.agent_id] = (counts[l.agent_id] || 0) + 1;
        });

        for (const [agentId, count] of Object.entries(counts)) {
            const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', agentId).maybeSingle();
            console.log(`- [${count} prospects] ID: ${agentId} (${profile?.full_name || 'Inconnu'} / ${profile?.email || 'Pas d\'email'})`);
        }
    } else {
        console.log('⚠️ ALERTE : Aucun prospect trouvé dans la base ! 🚫');
    }
}

audit();
