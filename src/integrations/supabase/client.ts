
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { BookingRequest, EventFile } from '@/types/database';
import { 
  STORAGE_BUCKETS, 
  normalizeFilePath, 
  getStorageUrl, 
  getFileUrl,
  associateFilesWithEntity
} from '@/services/fileService';

const supabaseUrl = "https://mrueqpffzauvdxmuwhfa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0";

export { STORAGE_BUCKETS, normalizeFilePath, getStorageUrl, getFileUrl };

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Function to associate uploaded files with events/bookings
export const associateFileWithEvent = async (file: File, eventId: string, userId: string) => {
  try {
    // Generate a unique file path - better structure for consistent access
    const fileExt = file.name.split('.').pop();
    const filePath = `${eventId}/${crypto.randomUUID()}.${fileExt}`;
    
    console.log(`Uploading file ${file.name} to ${STORAGE_BUCKETS.EVENT}/${filePath}`);
    
    // Upload to event_attachments bucket
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.EVENT)
      .upload(filePath, file);
      
    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }
    
    // Create record in event_files table
    const { data, error } = await supabase
      .from('event_files')
      .insert({
        event_id: eventId,
        filename: file.name,
        file_path: filePath,
        content_type: file.type,
        size: file.size,
        user_id: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) {
      console.error('Error creating file record:', error);
      throw error;
    }
    
    console.log('File successfully associated with event:', data);
    return data;
  } catch (error) {
    console.error('Error in associateFileWithEvent:', error);
    throw error;
  }
};

// Helper function to associate booking files with event
export const associateBookingFilesWithEvent = async (
  bookingId: string, 
  eventId: string, 
  userId: string
): Promise<EventFile[]> => {
  // Use the new centralized file association function
  return associateFilesWithEntity(bookingId, eventId, userId, 'booking', 'event') as Promise<EventFile[]>;
};
