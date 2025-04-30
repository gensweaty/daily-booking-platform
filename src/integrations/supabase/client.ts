
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

// Helper function to associate booking files with event
export const associateBookingFilesWithEvent = async (bookingId: string, eventId: string, userId: string) => {
  try {
    console.log(`Associating files from booking ${bookingId} with event ${eventId}`);
    
    // First, fetch all files associated with the booking request
    const { data: bookingFiles, error: fetchError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
      
    if (fetchError) {
      console.error('Error fetching booking files:', fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${bookingFiles?.length || 0} files for booking`, bookingFiles);
    
    if (!bookingFiles || bookingFiles.length === 0) {
      console.log('No files to associate');
      return [];
    }
    
    const processedFiles = [];
    
    // Process each file - copy from booking_attachments to event_attachments and create records
    for (const file of bookingFiles) {
      try {
        console.log(`Processing file: ${file.filename}, path: ${file.file_path}`);
        
        // Download the file from booking_attachments
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('booking_attachments')
          .download(file.file_path);
          
        if (downloadError) {
          console.error('Error downloading file from booking_attachments:', downloadError);
          continue;
        }
        
        // Generate a new unique file path for event_attachments
        const newFilePath = `${Date.now()}_${file.filename.replace(/\s+/g, '_')}`;
        
        // Upload to event_attachments
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(newFilePath, fileData);
          
        if (uploadError) {
          console.error('Error uploading file to event_attachments:', uploadError);
          continue;
        }
        
        console.log(`Successfully copied file to event_attachments/${newFilePath}`);
        
        // Create event_files record
        const { data: eventFile, error: eventFileError } = await supabase
          .from('event_files')
          .insert({
            filename: file.filename,
            file_path: newFilePath,
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
          processedFiles.push(eventFile);
          console.log('Created event file record:', eventFile);
        }
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
    
    return processedFiles;
  } catch (error) {
    console.error('Error in associateBookingFilesWithEvent:', error);
    throw error;
  }
};
