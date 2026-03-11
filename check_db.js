
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkData() {
    const { data: orgs } = await supabase.from('organizations').select('*').limit(1);
    console.log('Orgs:', orgs);
    if (orgs && orgs.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').eq('organization_id', orgs[0].id).limit(1);
        console.log('Profiles for this org:', profiles);
    }
}

checkData();
