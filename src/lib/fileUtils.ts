
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
    
    console.log(`Uploading file ${file.name} to path: ${filePath}`);
    
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
      file_path: filePath, // Store path without bucket prefix
      content_type: file.type,
      size: file.size,
      user_id: userId
    };
    
    console.log('Creating event_files record with data:', fileData);
    
    const { data: fileRecord, error: dbError } = await supabase
      .from('event_files')
      .insert(fileData)
      .select()
      .single();

    if (dbError) {
      console.error('Error creating file record:', dbError);
      return { success: false, error: dbError.message };
    }
    
    console.log('File uploaded successfully, record created:', fileRecord);
    return { success: true, file: fileRecord as FileRecord };
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
    
    // We need to check both booking_files table (if it exists) and event_files table
    // where event_id = bookingId (since booking requests files are also stored in event_files)
    
    // First check if booking_files table exists and contains any files
    try {
      const { data: bookingFiles, error: bookingFilesError } = await supabase
        .from('booking_files')
        .select('*')
        .eq('booking_request_id', bookingId);
        
      if (!bookingFilesError && bookingFiles && bookingFiles.length > 0) {
        console.log(`Found ${bookingFiles.length} files in booking_files table`);
        
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
        
        console.log('Successfully copied files from booking_files to event');
        return true;
      }
    } catch (err) {
      console.log('booking_files table might not exist, continuing with alternate approach');
    }
    
    // Check if there are files in event_files that belong to the booking
    const { data: eventFiles, error: eventFilesError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
    
    if (eventFilesError) {
      console.error('Error getting booking files from event_files:', eventFilesError);
      return false;
    }
    
    if (eventFiles && eventFiles.length > 0) {
      console.log(`Found ${eventFiles.length} files in event_files for booking`);
      
      // For each file, create a new record in event_files but with the new event ID
      const newEventFilesData = eventFiles.map(file => ({
        event_id: eventId,
        filename: file.filename,
        file_path: file.file_path,
        content_type: file.content_type,
        size: file.size,
        user_id: file.user_id,
        created_at: new Date().toISOString()
      }));
      
      const { error: insertError } = await supabase
        .from('event_files')
        .insert(newEventFilesData);
        
      if (insertError) {
        console.error('Error copying files to event:', insertError);
        return false;
      }
      
      console.log('Successfully copied files from event_files to new event');
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

/**
 * Get files for an event, including those originally uploaded through booking request
 */
export async function getAllEventFiles(eventId: string): Promise<FileRecord[]> {
  try {
    console.log(`Getting all files for event: ${eventId}`);
    
    // First get files directly from event_files
    const { data, error } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', eventId);
    
    if (error) {
      console.error('Error fetching event files:', error);
      throw error;
    }
    
    // Process files to ensure consistent path format
    const processedFiles = (data || []).map(file => {
      // Make sure the file path doesn't have the bucket prefix
      if (file.file_path && !file.file_path.startsWith('/')) {
        file.file_path = file.file_path.replace(/^event_attachments\//, '');
      }
      return file;
    });
    
    console.log(`Found ${processedFiles.length} files for event in event_files`);
    return processedFiles;
  } catch (error) {
    console.error('Exception in getAllEventFiles:', error);
    return [];
  }
}
