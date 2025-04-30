
import { createClient } from '@supabase/supabase-js';
import { BookingRequest, EventFile } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Define standard storage bucket names to ensure consistency
export const STORAGE_BUCKETS = {
  EVENT: 'event_attachments',
  BOOKING: 'booking_attachments',
  NOTE: 'note_attachments',
  TASK: 'task_attachments'
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

// Helper to normalize file paths for storage URLs (handle double slashes)
export const normalizeFilePath = (filePath: string) => {
  if (!filePath) return "";
  // Remove any leading slashes
  return filePath.replace(/^\/+/, '');
};

// Export the storage URL as a standalone function instead of attaching to supabase
export const getStorageUrl = () => `${supabaseUrl}/storage/v1`;

// Get a consistent file URL regardless of input bucket - always uses the actual bucket where file is stored
export const getFileUrl = (filePath: string, providedBucket?: string): string => {
  if (!filePath) return '';
  
  // We'll always use the EVENT bucket for now since that's where files are actually stored
  const effectiveBucket = STORAGE_BUCKETS.EVENT;
  
  const normalizedPath = normalizeFilePath(filePath);
  return `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
};

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

// Helper function to associate booking files with event
export const associateBookingFilesWithEvent = async (
  bookingId: string, 
  eventId: string, 
  userId: string
): Promise<EventFile[]> => {
  try {
    console.log(`Associating files from booking ${bookingId} with event ${eventId}`);
    const createdFileRecords: EventFile[] = [];
    
    // 1. First check if there are any files in event_files table with booking ID as event_id
    const { data: existingFiles, error: existingFilesError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
      
    if (existingFilesError) {
      console.error('Error fetching existing booking files:', existingFilesError);
    } else if (existingFiles && existingFiles.length > 0) {
      console.log(`Found ${existingFiles.length} files in event_files with booking ID ${bookingId}`);
      
      // Process each file by copying it to the new event
      for (const file of existingFiles) {
        try {
          // Get the actual file data from storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(STORAGE_BUCKETS.EVENT)
            .download(normalizeFilePath(file.file_path));

          if (downloadError) {
            console.error(`Error downloading existing file ${file.filename}:`, downloadError);
            continue;
          }

          // Create a new file path for the event
          const fileExtension = file.filename.includes('.') ? 
            file.filename.split('.').pop() || 'bin' : 'bin';
          
          const newFilePath = `${eventId}/${crypto.randomUUID()}.${fileExtension}`;
          
          // Upload to event_attachments with the new path
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKETS.EVENT)
            .upload(newFilePath, fileData, { 
              contentType: file.content_type || 'application/octet-stream' 
            });
            
          if (uploadError) {
            console.error('Error uploading file to event_attachments:', uploadError);
            continue;
          }

          // Create new event_files record
          const { data: newEventFile, error: newEventFileError } = await supabase
            .from('event_files')
            .insert({
              filename: file.filename,
              file_path: newFilePath, // Use the NEW path
              content_type: file.content_type,
              size: file.size,
              user_id: userId,
              event_id: eventId,
              source: 'booking_request'
            })
            .select()
            .single();
            
          if (newEventFileError) {
            console.error('Error creating event file record:', newEventFileError);
          } else if (newEventFile) {
            console.log(`Created new event file record for ${file.filename}`);
            createdFileRecords.push(newEventFile as EventFile);
            
            // Also create a customer file record
            try {
              const { data: customers } = await supabase
                .from('customers')
                .select('id')
                .eq('user_id', userId)
                .eq('title', file.user_surname || 'Unknown')
                .limit(1);
              
              if (customers && customers.length > 0) {
                const customerId = customers[0].id;
                
                const { error: customerFileError } = await supabase
                  .from('customer_files_new')
                  .insert({
                    customer_id: customerId,
                    filename: file.filename,
                    file_path: newFilePath,
                    content_type: file.content_type || 'application/octet-stream',
                    size: file.size || 0,
                    user_id: userId,
                    source: 'booking_request'
                  });
                  
                if (customerFileError) {
                  console.error('Error creating customer file record:', customerFileError);
                } else {
                  console.log('Created customer file record for the same file');
                }
              }
            } catch (error) {
              console.error('Error handling customer file creation:', error);
            }
          }
        } catch (error) {
          console.error(`Error processing file ${file.filename}:`, error);
        }
      }
    }
    
    // 2. Check for direct file fields in booking_requests
    const { data: bookingData, error: bookingError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();
      
    if (bookingError) {
      console.error('Error fetching booking request data:', bookingError);
    } else if (bookingData) {
      const booking = bookingData as BookingRequest;
      
      if (booking && booking.file_path && booking.filename) {
        try {
          console.log(`Processing direct file from booking_requests: ${booking.filename}, path: ${booking.file_path}`);
          
          // Download the file from booking_attachments
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(STORAGE_BUCKETS.BOOKING)
            .download(normalizeFilePath(booking.file_path));
            
          if (downloadError) {
            console.error('Error downloading file from booking_attachments:', downloadError);
          } else if (fileData) {
            // Generate a new unique file path for event_attachments
            const fileExtension = booking.filename.includes('.') ? 
              booking.filename.split('.').pop() || 'bin' : 'bin';
            
            const newFilePath = `${eventId}/${crypto.randomUUID()}.${fileExtension}`;
            
            // Upload to event_attachments
            const { error: uploadError } = await supabase.storage
              .from(STORAGE_BUCKETS.EVENT)
              .upload(newFilePath, fileData, { 
                contentType: booking.content_type || 'application/octet-stream' 
              });
              
            if (uploadError) {
              console.error('Error uploading file to event_attachments:', uploadError);
            } else {
              console.log(`Successfully copied file to ${STORAGE_BUCKETS.EVENT}/${newFilePath}`);
              
              // Create event_files record
              const { data: eventFile, error: eventFileError } = await supabase
                .from('event_files')
                .insert({
                  filename: booking.filename,
                  file_path: newFilePath,
                  content_type: booking.content_type || 'application/octet-stream',
                  size: booking.size || 0,
                  user_id: userId,
                  event_id: eventId,
                  source: 'booking_request'
                })
                .select()
                .single();
                
              if (eventFileError) {
                console.error('Error creating event file record:', eventFileError);
              } else if (eventFile) {
                console.log('Created event file record:', eventFile);
                createdFileRecords.push(eventFile as EventFile);
                
                // Also create customer file record
                try {
                  const { data: customers } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('user_id', userId)
                    .filter('title', 'eq', booking.requester_name)
                    .limit(1);
                  
                  if (customers && customers.length > 0) {
                    const customerId = customers[0].id;
                    
                    const { error: customerFileError } = await supabase
                      .from('customer_files_new')
                      .insert({
                        customer_id: customerId,
                        filename: booking.filename,
                        file_path: newFilePath,
                        content_type: booking.content_type || 'application/octet-stream',
                        size: booking.size || 0,
                        user_id: userId,
                        source: 'booking_request'
                      });
                      
                    if (customerFileError) {
                      console.error('Error creating customer file record:', customerFileError);
                    } else {
                      console.log('Created customer file record for the same file');
                    }
                  }
                } catch (error) {
                  console.error('Error creating customer file record:', error);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing direct booking file:', error);
        }
      } else {
        console.log('No direct file found on booking request row');
      }
    }
    
    return createdFileRecords;
  } catch (error) {
    console.error('Error in associateBookingFilesWithEvent:', error);
    return [];
  }
};

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
