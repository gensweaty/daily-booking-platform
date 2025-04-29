
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { FileRecord } from '@/types/files';

/**
 * Upload a file for an event and create the database record
 */
export async function uploadEventFile(
  eventId: string,
  file: File,
  userId: string
): Promise<{ success: boolean; file?: FileRecord; error?: string }> {
  try {
    // Generate a unique filename
    const fileExt = file.name.split('.').pop();
    const uniqueId = uuidv4();
    const filePath = `${eventId}/${Date.now()}_${uniqueId}.${fileExt}`;
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('event_attachments')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return { success: false, error: uploadError.message };
    }
    
    // Create file record in database
    const fileData = {
      event_id: eventId,
      filename: file.name,
      file_path: filePath,
      content_type: file.type,
      size: file.size,
      user_id: userId
    };
    
    const { data: fileRecord, error: dbError } = await supabase
      .from('event_files')
      .insert(fileData)
      .select()
      .single();

    if (dbError) {
      console.error('Error creating file record:', dbError);
      return { success: false, error: dbError.message };
    }
    
    return { success: true, file: fileRecord };
  } catch (error) {
    console.error('Exception in uploadEventFile:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Copy files from a booking request to an event
 */
export async function copyBookingFilesToEvent(
  bookingId: string,
  eventId: string
): Promise<boolean> {
  try {
    console.log(`Copying files from booking ${bookingId} to event ${eventId}`);
    
    // First try to get files from booking_files table
    const { data: bookingFiles, error: bookingFilesError } = await supabase
      .from('booking_files')
      .select('*')
      .eq('booking_request_id', bookingId);
      
    if (bookingFilesError) {
      console.error('Error getting booking files:', bookingFilesError);
      return false;
    }
    
    if (bookingFiles && bookingFiles.length > 0) {
      console.log(`Found ${bookingFiles.length} files to copy`);
      
      // For each file from booking_files, create a new record in event_files
      const eventFilesData = bookingFiles.map(file => ({
        event_id: eventId,
        filename: file.filename || 'attachment',
        file_path: file.file_path,
        content_type: file.content_type || 'application/octet-stream',
        size: file.size || 0,
        user_id: file.user_id,
        created_at: new Date().toISOString()
      }));
      
      const { error: insertError } = await supabase
        .from('event_files')
        .insert(eventFilesData);
        
      if (insertError) {
        console.error('Error copying files to event:', insertError);
        return false;
      }
      
      console.log('Successfully copied files to event');
      return true;
    }
    
    // As fallback, check if booking request itself has file metadata
    const { data: bookingRequest, error: bookingError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();
      
    if (bookingError || !bookingRequest) {
      console.error('Error getting booking request:', bookingError);
      return false;
    }
    
    if (bookingRequest.file_path) {
      const { error: insertError } = await supabase
        .from('event_files')
        .insert({
          event_id: eventId,
          filename: bookingRequest.filename || 'attachment',
          file_path: bookingRequest.file_path,
          content_type: bookingRequest.content_type || 'application/octet-stream',
          size: bookingRequest.file_size || bookingRequest.size || 0,
          user_id: bookingRequest.user_id,
          created_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Error copying booking file metadata to event:', insertError);
        return false;
      }
      
      console.log('Successfully copied booking file metadata to event');
      return true;
    }
    
    // No files found to copy
    console.log('No files found to copy from booking request');
    return true;
  } catch (error) {
    console.error('Exception in copyBookingFilesToEvent:', error);
    return false;
  }
}
