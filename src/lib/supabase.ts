
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
    detectSessionInUrl: true, // Enable this to help with automatic recovery token detection
    storage: localStorage,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce',
  },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      return fetch(input, init).catch(error => {
        console.error('Supabase fetch error:', error);
        throw error;
      });
    }
  }
});

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
  
  if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  } else if (event === 'USER_UPDATED') {
    console.log('User updated');
  } else if (event === 'SIGNED_IN') {
    console.log('User signed in');
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed');
  } else if (event === 'PASSWORD_RECOVERY') {
    console.log('Password recovery initiated');
  }
});
