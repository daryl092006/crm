import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const content = fs.readFileSync('./src/supabaseClient.ts', 'utf8');
const urlMatch = content.match(/supabaseUrl = '(.*?)'/);
const keyMatch = content.match(/supabaseAnonKey = '(.*?)'/);

const supabaseUrl = urlMatch[1];
const supabaseAnonKey = keyMatch[1];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: progs, error: errProgs } = await supabase.from('programs').select('*');
  console.log('Programs Error:', errProgs);
  
  const { data: srcs, error: errSrcs } = await supabase.from('prospect_sources').select('*');
  console.log('Sources Error:', errSrcs);
}

run();
