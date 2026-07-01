import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const clientContent = fs.readFileSync('./src/supabaseClient.ts', 'utf8');
const urlMatch = clientContent.match(/supabaseUrl = '(.*?)'/);
const keyMatch = clientContent.match(/supabaseAnonKey = '(.*?)'/);

const supabaseUrl = urlMatch[1];
const supabaseAnonKey = keyMatch[1];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function list() {
  console.log("Listing profiles...");
  const { data, error } = await supabase.from('profiles').select('*');
  console.log("Profiles:", data);
  console.log("Error:", error);
}

list();
