
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
  });
  
  // Log the user ID if session exists - helps with debugging
  if (session?.user) {
    console.log(`User authenticated: ${session.user.id.slice(0, 8)}...`);
  }
});

// Helper function to handle email confirmation links
export const handleEmailConfirmation = async (code: string) => {
  console.log("Processing email confirmation code via helper function:", code);
  
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("Error exchanging email confirmation code:", error);
      return { success: false, error };
    }
    
    if (data.session) {
      console.log("Email confirmation successful:", data.session.user?.id);
      return { success: true, session: data.session };
    }
    
    return { success: false, error: new Error("No session returned") };
  } catch (err) {
    console.error("Exception in handleEmailConfirmation:", err);
    return { success: false, error: err };
  }
};

// Add a function to verify email confirmation status
export const isEmailConfirmed = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email_confirmed_at != null;
  } catch (error) {
    console.error("Error checking email confirmation status:", error);
    return false;
  }
};
