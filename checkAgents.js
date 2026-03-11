import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ryzgxhfwuxpvnoxvscbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emd4aGZ3dXhwdm5veHZzY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDgzMjgsImV4cCI6MjA4ODcyNDMyOH0.raMGoau9uxCzHzQlIqrDMIEbwXp8QHJ6ZvCjuCgAPyY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAgents() {
  const { data, error } = await supabase.from('profiles').select('*');
  console.log(JSON.stringify(data, null, 2));
}

checkAgents();
