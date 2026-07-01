import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ryzgxhfwuxpvnoxvscbk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emd4aGZ3dXhwdm5veHZzY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDgzMjgsImV4cCI6MjA4ODcyNDMyOH0.raMGoau9uxCzHzQlIqrDMIEbwXp8QHJ6ZvCjuCgAPyY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'darylggt23@gmail.com',
    password: 'DarylEscen2026!'
  });
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  console.log("Authenticated as:", auth.user.email);
  
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log("Profiles count:", profiles?.length);
  profiles?.forEach(p => {
    console.log(`Profile: ${p.full_name} (${p.email}), Role: ${p.role}, Org: ${p.organization_id}`);
  });

  const { data: leads } = await supabase.from('leads').select('*');
  console.log("Leads count:", leads?.length);

  const leadsByAgent = {};
  leads?.forEach(l => {
    leadsByAgent[l.agent_id] = (leadsByAgent[l.agent_id] || 0) + 1;
  });
  console.log("Leads by agent ID:", leadsByAgent);
}

run();
