
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
  global: {
    fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  },
});

// Improved bucket creation with better error handling and retry logic
const ensureStorageBuckets = async () => {
  try {
    console.log("Checking if business_covers bucket exists...");
    
    // First check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("Error listing storage buckets:", bucketsError);
      // Don't throw here, we'll try to create the bucket anyway
    }
    
    const businessBucketExists = buckets?.some(b => b.name === 'business_covers');
    
    if (!businessBucketExists) {
      console.log("Creating business_covers bucket...");
      
      // Try creating the bucket
      const { data, error } = await supabase.storage.createBucket('business_covers', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        fileSizeLimit: 5000000 // 5MB
      });
      
      if (error) {
        console.error("Error creating business_covers bucket:", error);
        
        // Wait briefly and retry once
        console.log("Retrying bucket creation after a short delay...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { error: retryError } = await supabase.storage.createBucket('business_covers', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
          fileSizeLimit: 5000000 // 5MB
        });
        
        if (retryError) {
          console.error("Retry also failed:", retryError);
        } else {
          console.log("business_covers bucket created successfully on retry");
        }
      } else {
        console.log("business_covers bucket created successfully");
      }
      
      // Try to update the bucket policy to make it public - fixed method call
      try {
        const { error: policyError } = await supabase.storage.updateBucket('business_covers', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
          fileSizeLimit: 5000000 // 5MB
        });
        
        if (policyError) {
          console.error("Error updating bucket policy:", policyError);
        }
      } catch (policyError) {
        console.error("Error updating bucket policy:", policyError);
      }
    } else {
      console.log("business_covers bucket already exists");
      
      // Try to update the bucket policy to ensure it's public - fixed method call
      try {
        const { error: policyError } = await supabase.storage.updateBucket('business_covers', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
          fileSizeLimit: 5000000 // 5MB
        });
        
        if (policyError) {
          console.error("Error updating bucket policy:", policyError);
        }
      } catch (policyError) {
        console.error("Error updating bucket policy:", policyError);
      }
    }
  } catch (error) {
    console.error("Error in ensureStorageBuckets:", error);
  }
};

// Call this function immediately when the app loads
ensureStorageBuckets();

// Also expose it for explicit calls
export const forceBucketCreation = async () => {
  console.log("Force creating storage buckets...");
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
