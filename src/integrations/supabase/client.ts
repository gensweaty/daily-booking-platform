
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { BookingRequest, EventFile } from '@/types/database';

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
export const associateBookingFilesWithEvent = async (
  bookingId: string, 
  eventId: string, 
  userId: string
): Promise<EventFile | null> => {
  try {
    console.log(`Associating files from booking ${bookingId} with event ${eventId}`);
    
    // 1. First check if there are booking file fields in booking_requests
    const { data: bookingData, error: bookingError } = await supabase
      .from('booking_requests')
      .select('*')  // Select all fields to ensure we get the file data
      .eq('id', bookingId)
      .maybeSingle();
      
    if (bookingError) {
      console.error('Error fetching booking request data:', bookingError);
      return null;
    }
    
    // Cast data to BookingRequest type for better TypeScript support
    const booking = bookingData as BookingRequest | null;
    if (!booking) {
      console.error('No booking data found');
      return null;
    }
    
    // Track all created file records to return
    let createdFileRecord: EventFile | null = null;
    
    // 2. Process file from booking_requests table if available
    if (booking && typeof booking.file_path === 'string' && booking.file_path.trim()) {
      const originalFilePath = booking.file_path;
      const originalFileName = typeof booking.filename === 'string' ? booking.filename : 'attachment';
      const originalContentType = typeof booking.content_type === 'string' ? booking.content_type : 'application/octet-stream';
      const originalSize = typeof booking.size === 'number' ? booking.size : 0;
      
      console.log(`Processing file from booking_requests: ${originalFileName}, path: ${originalFilePath}`);
      
      try {
        // Download the file from booking_attachments
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('booking_attachments')
          .download(normalizeFilePath(originalFilePath));
          
        if (downloadError) {
          console.error('Error downloading file from booking_attachments:', downloadError);
          throw downloadError;
        }
        
        if (!fileData) {
          console.error('No file data returned when downloading from booking_attachments');
          throw new Error('No file data returned from storage');
        }
        
        // Generate a new unique file path for event_attachments
        const fileExtension = originalFileName.includes('.') ? 
          originalFileName.split('.').pop() || 'bin' : 'bin';
        
        const newFilePath = `${eventId}/${crypto.randomUUID()}.${fileExtension}`;
        
        // Upload to event_attachments
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(newFilePath, fileData, { contentType: originalContentType });
          
        if (uploadError) {
          console.error('Error uploading file to event_attachments:', uploadError);
          throw uploadError;
        }
        
        console.log(`Successfully copied file to event_attachments/${newFilePath}`);
        
        // Create event_files record
        const { data: eventFile, error: eventFileError } = await supabase
          .from('event_files')
          .insert({
            filename: originalFileName,
            file_path: newFilePath,
            content_type: originalContentType,
            size: originalSize,
            user_id: userId,
            event_id: eventId,
            source: 'booking_request'
          })
          .select()
          .single();
          
        if (eventFileError) {
          console.error('Error creating event file record:', eventFileError);
          throw eventFileError;
        }
        
        console.log('Created event file record:', eventFile);
        createdFileRecord = eventFile as EventFile;
      } catch (error) {
        console.error('Error processing direct booking file:', error);
      }
    } else {
      console.log('No direct file found on booking request row');
    }
    
    // Return the created file record or null
    return createdFileRecord;
  } catch (error) {
    console.error('Error in associateBookingFilesWithEvent:', error);
    return null;
  }
};
