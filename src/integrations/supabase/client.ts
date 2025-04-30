
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Export the storage URL as a standalone function
export const getStorageUrl = () => `${supabaseUrl}/storage/v1`;

// Helper to normalize file paths for storage URLs (handle double slashes)
export const normalizeFilePath = (filePath: string) => {
  if (!filePath) return "";
  // Remove any leading slashes
  return filePath.replace(/^\/+/, '');
};

export async function associateBookingFilesWithEvent(
  bookingId: string, 
  eventId: string, 
  userId: string
) {
  try {
    console.log(`Associating files from booking ${bookingId} to event ${eventId}`);
    
    // Check for existing files attached to the booking request
    const { data: bookingFiles, error: filesError } = await supabase
      .from('booking_files')
      .select('*')
      .eq('booking_request_id', bookingId);
    
    if (filesError) {
      console.error('Error fetching booking files:', filesError);
      return null;
    }
    
    if (!bookingFiles || bookingFiles.length === 0) {
      console.log('No files found for this booking request');
      return null;
    }
    
    console.log(`Found ${bookingFiles.length} files to transfer from booking to event`);
    
    // Process all files from the booking request
    const eventFiles = [];
    
    for (const file of bookingFiles) {
      try {
        console.log(`Processing file: ${file.filename}, path: ${file.file_path}`);
        
        // Create an event file record pointing to the same storage location
        const { data: eventFile, error: eventFileError } = await supabase
          .from('event_files')
          .insert({
            filename: file.filename,
            file_path: file.file_path,
            content_type: file.content_type,
            size: file.size,
            user_id: userId,
            event_id: eventId
          })
          .select()
          .single();
        
        if (eventFileError) {
          console.error('Error creating event file record:', eventFileError);
        } else {
          eventFiles.push(eventFile);
        }
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
    
    return eventFiles.length > 0 ? eventFiles[0] : null;
  } catch (error) {
    console.error('Error in associateBookingFilesWithEvent:', error);
    return null;
  }
}

// Function to create storage buckets if they don't exist
export async function ensureStorageBuckets() {
  try {
    // Check if event_attachments bucket exists
    const { data: bucketData, error: bucketError } = await supabase
      .storage
      .getBucket('event_attachments');
    
    // If bucket doesn't exist, create it
    if (bucketError && bucketError.message.includes('does not exist')) {
      console.log('Creating event_attachments storage bucket');
      const { data, error } = await supabase
        .storage
        .createBucket('event_attachments', { public: true });
      
      if (error) {
        console.error('Error creating event_attachments bucket:', error);
      } else {
        console.log('Successfully created event_attachments bucket');
      }
    }
    
    // Check if booking_attachments bucket exists
    const { data: bookingBucketData, error: bookingBucketError } = await supabase
      .storage
      .getBucket('booking_attachments');
    
    // If bucket doesn't exist, create it
    if (bookingBucketError && bookingBucketError.message.includes('does not exist')) {
      console.log('Creating booking_attachments storage bucket');
      const { data, error } = await supabase
        .storage
        .createBucket('booking_attachments', { public: true });
      
      if (error) {
        console.error('Error creating booking_attachments bucket:', error);
      } else {
        console.log('Successfully created booking_attachments bucket');
      }
    }
  } catch (error) {
    console.error('Error ensuring storage buckets exist:', error);
  }
}

// Call this function when the app initializes
ensureStorageBuckets();
