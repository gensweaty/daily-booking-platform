
import { supabase, getStorageUrl } from "@/integrations/supabase/client";
import { FileRecord } from "@/types/files";

// Helper to get bucket URL for a file
export const getFileBucketUrl = (bucketName: string, filePath: string): string => {
  const url = new URL(`object/public/${bucketName}/${filePath}`, getStorageUrl());
  return url.toString();
};

// Normalize file path by removing any UUID prefix that might be present in uploaded files
export const normalizeFilePath = (path: string): string => {
  // Check if path has UUID directory structure (common in Supabase storage)
  const uuidPathRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\//i;
  if (uuidPathRegex.test(path)) {
    return path.replace(uuidPathRegex, '');
  }
  return path;
};

// Fetch files for an event - including those from original booking if applicable
export const getAllEventFiles = async (eventId: string): Promise<FileRecord[]> => {
  try {
    console.log(`Fetching files for event: ${eventId}`);
    
    // First get the event to check if it has an original booking ID
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('original_booking_id')
      .eq('id', eventId)
      .maybeSingle();
      
    if (eventError) {
      console.error("Error fetching event details:", eventError);
      return [];
    }
    
    // Get files attached directly to this event
    const { data: eventFiles, error: filesError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', eventId);
      
    if (filesError) {
      console.error("Error fetching event files:", filesError);
      return [];
    }
    
    let result = eventFiles || [];
    console.log(`Found ${result.length} files directly attached to event`);
    
    // If the event was created from a booking, also get original booking files
    if (event?.original_booking_id) {
      console.log(`Event was created from booking ${event.original_booking_id}, checking for original files`);
      
      const { data: bookingFiles, error: bookingError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', event.original_booking_id);
        
      if (!bookingError && bookingFiles && bookingFiles.length > 0) {
        console.log(`Found ${bookingFiles.length} files from original booking`);
        
        // Use a Set to track unique file paths to avoid duplicates
        const existingPaths = new Set(result.map(file => file.file_path));
        
        // Add only booking files that don't already exist in event files
        const uniqueBookingFiles = bookingFiles.filter(file => !existingPaths.has(file.file_path));
        
        if (uniqueBookingFiles.length > 0) {
          console.log(`Adding ${uniqueBookingFiles.length} unique files from booking`);
          result = [...result, ...uniqueBookingFiles];
        }
      }
    }
    
    console.log(`Returning ${result.length} total files for event`);
    return result;
  } catch (error) {
    console.error("Error in getAllEventFiles:", error);
    return [];
  }
};
