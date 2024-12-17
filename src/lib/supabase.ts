import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test connection immediately
console.log('Testing Supabase connection...');
supabase.from('profiles').select('count').single()
  .then(response => {
    if (response.error) {
      console.error('Database connection test failed:', response.error);
    } else {
      console.log('Database connection test successful');
    }
  });