import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const clientContent = fs.readFileSync('./src/supabaseClient.ts', 'utf8');
const urlMatch = clientContent.match(/supabaseUrl = '(.*?)'/);
const keyMatch = clientContent.match(/supabaseAnonKey = '(.*?)'/);

const supabaseUrl = urlMatch[1];
const supabaseAnonKey = keyMatch[1];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: campaigns } = await supabase.from('campaigns').select('id, name, column_mappings');
  console.log("Campaigns with mappings:", JSON.stringify(campaigns, null, 2));
}

check();
