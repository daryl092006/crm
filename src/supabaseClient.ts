
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION OFFICIELLE ESCEN CRM (SOCIÉTÉ) --- 🚀
const supabaseUrl = 'https://ryzgxhfwuxpvnoxvscbk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emd4aGZ3dXhwdm5veHZzY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDgzMjgsImV4cCI6MjA4ODcyNDMyOH0.raMGoau9uxCzHzQlIqrDMIEbwXp8QHJ6ZvCjuCgAPyY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
