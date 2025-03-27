
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
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: localStorage,
  },
});

// Enhanced debug listener for auth events with more detailed information
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`Auth state changed: ${event}`, {
    hasSession: !!session,
    event,
    // Log token type if session exists to help debug 
    tokenType: session?.token_type,
    // Add URL info to debug redirects
    currentUrl: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    // Add user info if available
    userId: session?.user?.id,
    userEmail: session?.user?.email,
  });
});

// Specific handling for production environment
const isProdEnv = window.location.host === 'smartbookly.com';

if (isProdEnv) {
  console.log("Production environment detected - applying special handling for auth flows");
  
  // Immediately attempt to exchange code if present in URL
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  
  if (code && (url.pathname === '/dashboard' || url.pathname === '/login')) {
    console.log(`Auth code detected in URL on ${url.pathname}, attempting exchange...`);
    
    (async () => {
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error("Error exchanging URL code for session:", error);
          // On error in prod, redirect to login with error
          window.location.href = '/login?error=confirmation_failed';
        } else if (data?.session) {
          console.log("Successfully exchanged URL code for session in prod environment");
          // Refresh to remove code from URL
          window.location.href = '/dashboard';
        }
      } catch (err) {
        console.error("Exception in production code exchange:", err);
        window.location.href = '/login?error=confirmation_failed';
      }
    })();
  }
}
