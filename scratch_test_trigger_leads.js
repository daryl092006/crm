import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const clientContent = fs.readFileSync('./src/supabaseClient.ts', 'utf8');
const urlMatch = clientContent.match(/supabaseUrl = '(.*?)'/);
const keyMatch = clientContent.match(/supabaseAnonKey = '(.*?)'/);

const supabaseUrl = urlMatch[1];
const supabaseAnonKey = keyMatch[1];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL = 'darylggt23@gmail.com';
const PASS = 'DarylEscen2026!';

async function run() {
  console.log("Signing in...");
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASS });
  
  // If credentials fail, we'll try to insert anonymously (which might fail with RLS but let's see if we get RLS or database error)
  const token = signInData?.session?.access_token;
  console.log("Token acquired:", !!token);

  const client = token ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  }) : supabase;

  // Let's get a campaign
  const { data: campaigns } = await client.from('campaigns').select('*').limit(1);
  const campaignId = campaigns?.[0]?.id || '00000000-0000-0000-0000-000000000000';
  
  // Let's get an agent
  const { data: agents } = await client.from('profiles').select('*').eq('role', 'agent').limit(1);
  const agentId = agents?.[0]?.id;

  console.log("Inserting lead with agentId:", agentId);
  const { data, error } = await client
    .from('leads')
    .insert({
      organization_id: '00000000-0000-0000-0000-000000000000',
      campaign_id: campaignId,
      first_name: 'TestTrigger',
      last_name: 'Lead',
      phone: '+22899999999',
      agent_id: agentId || null, // If we have an agent, this will trigger notify_agent_assignment trigger!
      status_id: 'nouveau'
    })
    .select();

  console.log("Insert result:", { data, error });
}

run();
