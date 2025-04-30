
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
    
    // FIXED: First, check if there are files in the booking_requests table
    const { data: bookingData, error: bookingError } = await supabase
      .from('booking_requests')
      .select('file_path, filename, content_type, size')
      .eq('id', bookingId)
      .maybeSingle();
      
    if (bookingError) {
      console.error('Error fetching booking request data:', bookingError);
      // Continue with event_files check as a fallback
    } else if (bookingData && bookingData.file_path) {
      console.log(`Found file directly on booking request: ${bookingData.filename || 'attachment'}`);
      
      // Process file from booking_requests
      const originalFilePath = bookingData.file_path;
      const originalFileName = bookingData.filename || 'attachment';
      const originalContentType = bookingData.content_type || 'application/octet-stream';
      const originalSize = bookingData.size || 0;
      
      try {
        // Download the file from booking_attachments
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('booking_attachments')
          .download(normalizeFilePath(originalFilePath));
          
        if (downloadError) {
          console.error('Error downloading file from booking_attachments:', downloadError);
          throw downloadError;
        }
        
        // Generate a new unique file path for event_attachments
        const fileExt = originalFileName.split('.').pop() || 'bin';
        const newFilePath = `${eventId}/${crypto.randomUUID()}.${fileExt}`;
        
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
        return [eventFile];
      } catch (error) {
        console.error('Error processing direct booking file:', error);
        // Fall through to check event_files as a backup
      }
    }
    
    // BACKUP APPROACH: Check for files in event_files table (legacy path)
    const { data: bookingFiles, error: fetchError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
      
    if (fetchError) {
      console.error('Error fetching booking files from event_files:', fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${bookingFiles?.length || 0} files in event_files table for booking`, bookingFiles);
    
    if (!bookingFiles || bookingFiles.length === 0) {
      console.log('No files to associate');
      return [];
    }
    
    const processedFiles = [];
    
    // Process each file from event_files
    for (const file of bookingFiles) {
      try {
        console.log(`Processing file from event_files: ${file.filename}, path: ${file.file_path}`);
        
        // Download the file from booking_attachments
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('booking_attachments')
          .download(normalizeFilePath(file.file_path));
          
        if (downloadError) {
          console.error('Error downloading file from booking_attachments:', downloadError);
          continue;
        }
        
        // Generate a new unique file path for event_attachments
        const fileExt = file.filename.split('.').pop() || 'bin';
        const newFilePath = `${eventId}/${Date.now()}_${file.filename.replace(/\s+/g, '_')}`;
        
        // Upload to event_attachments
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(newFilePath, fileData, { contentType: file.content_type });
          
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
            event_id: eventId,
            source: 'booking_request'
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
