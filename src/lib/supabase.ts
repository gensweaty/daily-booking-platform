
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Get the current base URL for redirects - handling both dev and production environments
const getBaseUrl = () => {
  // For development or preview deployments
  if (window.location.hostname.includes('localhost') || 
      window.location.hostname.includes('.lovableproject.com')) {
    return window.location.origin;
  }
  
  // For production - smartbookly.com - explicitly set to avoid UNDEFINED_VALUE errors
  return 'https://smartbookly.com';
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key) => {
        try {
          const storedSession = localStorage.getItem(key);
          // Store a copy in sessionStorage as backup
          if (storedSession) {
            sessionStorage.setItem(`backup_${key}`, storedSession);
          }
          return storedSession;
        } catch (error) {
          console.error("Error reading auth from localStorage:", error);
          // Try to recover from sessionStorage
          try {
            return sessionStorage.getItem(`backup_${key}`);
          } catch (e) {
            console.error("Failed to recover from sessionStorage:", e);
            return null;
          }
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
          // Always keep a backup in sessionStorage
          sessionStorage.setItem(`backup_${key}`, value);
        } catch (error) {
          console.error("Error storing auth in localStorage:", error);
          // Try sessionStorage as fallback
          try {
            sessionStorage.setItem(`backup_${key}`, value);
          } catch (e) {
            console.error("Failed to store in sessionStorage:", e);
          }
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(`backup_${key}`);
        } catch (error) {
          console.error("Error removing auth from storage:", error);
        }
      },
    },
  },
  global: {
    fetch: (...args: Parameters<typeof fetch>) => {
      const [url, options] = args;
      // Add retry logic for important endpoints
      return fetch(url, options).catch(async (error) => {
        console.error(`Fetch error for ${typeof url === 'string' ? url : 'request'}:`, error);
        
        // Only retry for non-GET methods or specific endpoints
        const urlString = url.toString();
        if ((options?.method && options.method !== 'GET') || 
            urlString.includes('business_profiles') || 
            urlString.includes('booking_requests')) {
          
          console.log("Retrying important request after error");
          // Wait a moment before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetch(url, options);
        }
        
        throw error;
      });
    },
  },
});

// Improved bucket verification - only checks if it exists and logs the settings
const ensureStorageBuckets = async () => {
  try {
    console.log("Checking if business_covers bucket exists...");
    
    // First check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("Error listing storage buckets:", bucketsError);
      return; // Exit early if we can't even list buckets
    }
    
    const businessBucket = buckets?.find(b => b.name === 'business_covers');
    
    if (businessBucket) {
      console.log("business_covers bucket exists with settings:", businessBucket);
      console.log(`Current file size limit: ${businessBucket.file_size_limit || 'default'}`);
    } else {
      console.log("business_covers bucket not found in the list of buckets");
    }
  } catch (error) {
    console.error("Error in ensureStorageBuckets:", error);
  }
};

// Call this function immediately when the app loads
ensureStorageBuckets();

// Also expose it for explicit calls
export const forceBucketCreation = async () => {
  console.log("Verifying storage bucket settings...");
  return ensureStorageBuckets();
};

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

  // Store session summary in sessionStorage for recovery purposes
  if (session) {
    try {
      sessionStorage.setItem('auth_session_summary', JSON.stringify({
        userId: session.user?.id,
        token_type: session.token_type,
        expiresAt: session.expires_at,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error("Failed to store session summary:", e);
    }
  }

  // Special handling for email confirmation parameters
  const searchParams = new URLSearchParams(window.location.search);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const typeParam = searchParams.get('type');
  
  if (code) {
    console.log("Auth code detected, attempting exchange:", code.substring(0, 5) + '...');
    
    // Process the code to exchange for a session
    (async () => {
      try {
        console.log("Starting code exchange");
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error("Error exchanging code for session:", error);
          window.location.href = '/login?error=confirmation_failed';
        } else if (data?.session) {
          console.log("Successfully exchanged code for session");
          // Clean URL and redirect to dashboard
          const cleanUrl = window.location.pathname === '/signup' || window.location.pathname === '/login' 
            ? '/dashboard' 
            : window.location.pathname;
          
          window.location.href = cleanUrl;
        }
      } catch (err) {
        console.error("Exception exchanging code:", err);
        window.location.href = '/login?error=confirmation_failed';
      }
    })();
  }
  
  // Enhanced error handling for auth redirects
  if (errorParam === 'confirmation_failed') {
    console.error("Email confirmation failed, showing error message");
  }
});

// Specific handling for production environment - needed for smartbookly.com
// UPDATED: More robust hostname check to handle www and subdomains
const isProdEnv = window.location.hostname.includes('smartbookly.com');

if (isProdEnv) {
  console.log("Production environment detected - applying special handling for auth flows");
  
  // Immediately attempt to exchange code if present in URL
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  
  if (code && (url.pathname === '/dashboard' || url.pathname === '/login' || url.pathname === '/signup')) {
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

// Export a dedicated function for signup operations with proper URL handling
export const getRedirectUrl = () => {
  // We intentionally use a fixed production URL for the smartbookly.com domain
  // to prevent the UNDEFINED_VALUE errors
  if (window.location.hostname.includes('smartbookly.com')) {
    return 'https://smartbookly.com';
  }
  
  // For development or preview environments, use the current origin
  return window.location.origin;
};
