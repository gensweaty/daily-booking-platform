
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Must be false to manually handle the code parameter
    flowType: 'pkce',
  },
});

// Debug listener for auth events - helpful for troubleshooting
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`Auth state changed: ${event}`, session ? 'Session exists' : 'No session');
});
