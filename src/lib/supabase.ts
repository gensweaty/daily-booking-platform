
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
  },
});

// Export the storage URL as a standalone function instead of attaching to supabase
export const getStorageUrl = () => `${supabaseUrl}/storage/v1`;

// Helper to normalize file paths for storage URLs (handle double slashes)
export const normalizeFilePath = (filePath: string) => {
  if (!filePath) return "";
  // Remove any leading slashes
  return filePath.replace(/^\/+/, '');
};

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

  // Special handling for email confirmation code on dashboard
  if (window.location.pathname === '/dashboard' && window.location.search.includes('code=')) {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    
    if (code) {
      console.log("Dashboard detected with confirmation code:", code.substring(0, 5) + '...');
      
      // Process the code to exchange for a session
      (async () => {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error("Error exchanging code for session:", error);
            // Redirect to login on error
            window.location.href = '/login?error=confirmation_failed';
          } else if (data?.session) {
            console.log("Successfully exchanged code for session on dashboard");
            // Refresh dashboard without the code parameter
            window.location.href = '/dashboard';
          }
        } catch (err) {
          console.error("Exception exchanging code:", err);
          window.location.href = '/login?error=confirmation_failed';
        }
      })();
    }
  }
});

// Specific handling for production environment - needed for smartbookly.com
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
