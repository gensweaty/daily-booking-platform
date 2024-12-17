import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Test connection immediately
console.log('Testing Supabase connection...');
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Auth connection test failed:', error);
  } else {
    console.log('Auth connection test successful:', data);
  }
});