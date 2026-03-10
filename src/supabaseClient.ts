import { createClient } from '@supabase/supabase-js';

// Remplacer par vos propres identifiants Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'VOTRE_URL_SUPABASE';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'VOTRE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
