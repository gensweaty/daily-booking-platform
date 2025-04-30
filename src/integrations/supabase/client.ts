
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
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
    
    if (filesError) {
      console.error('Error fetching booking files:', filesError);
      return null;
    }
    
    if (!bookingFiles || bookingFiles.length === 0) {
      console.log('No files found for this booking request');
      return null;
    }
    
    console.log(`Found ${bookingFiles.length} files to transfer from booking to event`);
    
    // Process the first file (most booking requests will have only one file)
    const file = bookingFiles[0];
    
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
        return null;
      }
      
      return eventFile;
    } catch (error) {
      console.error('Error processing file:', error);
      return null;
    }
  } catch (error) {
    console.error('Error in associateBookingFilesWithEvent:', error);
    return null;
  }
}
