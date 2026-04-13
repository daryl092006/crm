
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- SCANNER FINAL BADGE AMAH ---');
    const { data } = await supabase.from('leads').select('id').eq('agent_id', 'f692a874-5eb9-408c-b021-d1be8e05cb6b');
    console.log('TOTAL PROSPECTS SUR LE BADGE f692: ' + (data?.length || 0));
}

check();
