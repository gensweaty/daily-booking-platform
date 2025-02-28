
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
    detectSessionInUrl: false, // IMPORTANT: We're handling recovery tokens manually
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

// Helper to check recovery URL parameters
const hasRecoveryParams = () => {
  return (
    window.location.hash.includes('access_token=') || 
    window.location.search.includes('token_hash=') || 
    window.location.search.includes('type=recovery')
  );
};

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
  
  if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  } else if (event === 'USER_UPDATED') {
    console.log('User updated');
  } else if (event === 'SIGNED_IN') {
    console.log('User signed in');
    
    // Special handling for password reset flow
    if (hasRecoveryParams()) {
      console.log('Detected recovery parameters during sign in - redirecting to reset password page');
      const currentPath = window.location.pathname;
      if (currentPath !== '/reset-password') {
        window.location.href = '/reset-password' + window.location.search + window.location.hash;
      }
    }
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed');
  } else if (event === 'PASSWORD_RECOVERY') {
    console.log('Password recovery initiated');
    
    // Ensure we redirect to reset password page
    const currentPath = window.location.pathname;
    if (currentPath !== '/reset-password') {
      console.log('Redirecting to reset password page from PASSWORD_RECOVERY event');
      window.location.href = '/reset-password' + window.location.search + window.location.hash;
    }
  }
});

// Custom error handler
window.addEventListener('supabase.auth.error', (event) => {
  const error = (event as CustomEvent).detail;
  console.error('Supabase auth error:', error);
  
  // Don't show expired session errors for password reset flow
  if (hasRecoveryParams() || 
      window.location.pathname.includes('/forgot-password') || 
      window.location.pathname.includes('/reset-password')) {
    console.log('Ignoring auth error in password reset flow');
    return;
  }
});
