import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ryzgxhfwuxpvnoxvscbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emd4aGZ3dXhwdm5veHZzY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDgzMjgsImV4cCI6MjA4ODcyNDMyOH0.raMGoau9uxCzHzQlIqrDMIEbwXp8QHJ6ZvCjuCgAPyY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
  console.log("--- PROFILES ---");
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log(profiles);

  console.log("--- LEADS BY AGENT ---");
  const { data: leads } = await supabase.from('leads').select('id, agent_id, organization_id, status_id');
  console.log(`Total leads: ${leads?.length}`);
  
  const counts = {};
  leads?.forEach(l => {
    const key = `${l.agent_id || 'null'}:${l.organization_id || 'null'}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  console.log(counts);
}

inspect();
