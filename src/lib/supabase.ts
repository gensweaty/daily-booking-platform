import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Custom domain detection
const isDevelopment = window.location.host.includes('localhost') || window.location.host.includes('lovable.app');
const domain = isDevelopment ? window.location.origin : 'https://smartbookly.com';
console.log(`Environment detected: ${isDevelopment ? 'Development' : 'Production'}, using domain: ${domain}`);

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
    fetch: globalThis.fetch, // Use native fetch without retry logic to avoid conflicts
  },
});

// Enhanced onAuthStateChange listener with better error handling
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`Auth state changed: ${event}`, {
    hasSession: !!session,
    event,
    tokenType: session?.token_type,
    currentUrl: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
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
