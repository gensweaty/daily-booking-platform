import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = "https://mrueqpffzauvdxmuwhfa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper function to normalize file paths by removing any potential starting slash
export const normalizeFilePath = (path: string): string => {
  return path.startsWith('/') ? path.substring(1) : path;
};

// Helper function to get the storage URL
export const getStorageUrl = (): string => {
  return `${supabaseUrl}/storage/v1`;
};

// Helper function to associate files from booking requests with new calendar events
export const associateBookingFilesWithEvent = async (bookingId: string, eventId: string): Promise<void> => {
  try {
    console.log(`Associating files from booking ${bookingId} with event ${eventId}`);
    
    // First, find all files associated with the booking request
    const { data: bookingFiles, error: fetchError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
      
    if (fetchError) {
      console.error('Error fetching booking files:', fetchError);
      return;
    }
    
    if (!bookingFiles || bookingFiles.length === 0) {
      console.log('No files found for booking request:', bookingId);
      return;
    }
    
    console.log(`Found ${bookingFiles.length} files to associate with event ${eventId}`);
    
    // Create new file entries that point to the same storage objects but are associated with the event
    for (const file of bookingFiles) {
      const { error: insertError } = await supabase
        .from('event_files')
        .insert({
          filename: file.filename,
          file_path: file.file_path,
          content_type: file.content_type,
          size: file.size,
          user_id: file.user_id,
          event_id: eventId
        });
        
      if (insertError) {
        console.error('Error creating file association:', insertError);
      }
    }
    
    console.log('Successfully associated booking files with event');
  } catch (error) {
    console.error('Exception in associateBookingFilesWithEvent:', error);
  }
};
