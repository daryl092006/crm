import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const clientContent = fs.readFileSync('./src/supabaseClient.ts', 'utf8');
const urlMatch = clientContent.match(/supabaseUrl = '(.*?)'/);
const keyMatch = clientContent.match(/supabaseAnonKey = '(.*?)'/);

const supabaseUrl = urlMatch[1];
const supabaseAnonKey = keyMatch[1];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL = 'a.amah@escen.university';
const PASS = 'AmahEscen2026!';

async function run() {
  console.log("Signing in...");
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (signInError) {
    console.error("Sign in failed:", signInError);
    return;
  }
  const user = signInData.user;
  console.log("Signed in successfully. User ID:", user.id);

  // 1. Get campaigns
  const { data: campaigns, error: campError } = await supabase.from('campaigns').select('*').limit(1);
  if (campError) {
    console.error("Campaigns fetch error:", campError);
    return;
  }
  if (!campaigns || campaigns.length === 0) {
    console.error("No campaigns found in database.");
    return;
  }
  const campaignId = campaigns[0].id;
  console.log("Using campaign ID:", campaignId);

  // 2. Fetch programs and prospect_sources
  const { data: progs, error: progsError } = await supabase.from('programs').select('*').eq('is_active', true);
  console.log("programs:", { length: progs?.length, error: progsError });

  const { data: srcs, error: srcsError } = await supabase.from('prospect_sources').select('*').eq('is_active', true);
  console.log("prospect_sources:", { length: srcs?.length, error: srcsError });

  // 3. Create prospect_import_batches
  const batchId = crypto.randomUUID();
  console.log("Inserting batch with ID:", batchId);
  const { error: batchError } = await supabase
    .from('prospect_import_batches')
    .insert({
      id: batchId,
      campaign_id: campaignId,
      imported_by: user.id,
      file_name: 'test.xlsx',
      source: 'Excel/CSV',
      total_rows: 1,
      valid_rows: 1,
      inserted_rows: 1,
      duplicate_rows: 0,
      rejected_rows: 0,
      status: 'completed',
      mapping: [],
      report: {},
      completed_at: new Date().toISOString()
    });

  if (batchError) {
    console.error("Batch insert failed:", batchError);
    return;
  }
  console.log("Batch inserted successfully.");

  // 4. Insert lead into leads table
  console.log("Inserting lead...");
  const { error: leadError } = await supabase
    .from('leads')
    .insert({
      organization_id: '00000000-0000-0000-0000-000000000000',
      campaign_id: campaignId,
      first_name: 'TestImport',
      last_name: 'Lead',
      email: `test_import_${Date.now()}@example.com`,
      phone: `+22890000${Math.floor(Math.random() * 900 + 100)}`,
      whatsapp: null,
      city: 'Lome',
      country: 'Togo',
      field_of_interest: null,
      study_level: null,
      status_id: 'nouveau',
      source: 'Excel/CSV',
      import_batch_id: batchId,
      program_id: null,
      source_id: null
    });

  if (leadError) {
    console.error("Lead insert failed:", leadError);
    return;
  }
  console.log("Lead inserted successfully!");
}

run();
