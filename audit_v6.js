
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- SCANNER DE REPARTITION AGENT ID ---');
    const { data } = await supabase.from('leads').select('agent_id');
    if (data) {
        const counts = {};
        data.forEach(l => {
            const sid = l.agent_id || 'unassigned';
            counts[sid] = (counts[sid] || 0) + 1;
        });
        console.log(JSON.stringify(counts));
    }
}

check();
