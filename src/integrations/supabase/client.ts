
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

// Helper function to associate booking files with event - completely rewritten for robustness
export const associateBookingFilesWithEvent = async (bookingId: string, eventId: string, userId: string) => {
  try {
    console.log(`Associating files from booking ${bookingId} with event ${eventId}`);
    
    // 1. First check if there are booking file fields in booking_requests
    const { data: bookingData, error: bookingError } = await supabase
      .from('booking_requests')
      .select('file_path, filename, content_type, size')
      .eq('id', bookingId)
      .maybeSingle();
      
    if (bookingError) {
      console.error('Error fetching booking request data:', bookingError);
      return [];
    }
    
    // Track all created file records to return
    const createdFileRecords = [];
    
    // 2. Process file from booking_requests table if available
    if (bookingData && typeof bookingData.file_path === 'string' && bookingData.file_path.trim()) {
      const originalFilePath = bookingData.file_path;
      const originalFileName = typeof bookingData.filename === 'string' ? bookingData.filename : 'attachment';
      const originalContentType = typeof bookingData.content_type === 'string' ? bookingData.content_type : 'application/octet-stream';
      const originalSize = typeof bookingData.size === 'number' ? bookingData.size : 0;
      
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
        const fileExtRaw = originalFileName.split('.').pop();
        const fileExt = fileExtRaw && typeof fileExtRaw === 'string' ? fileExtRaw : 'bin';
        
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
        createdFileRecords.push(eventFile);
      } catch (error) {
        console.error('Error processing direct booking file:', error);
      }
    } else {
      console.log('No direct file found on booking request row');
    }
    
    // 3. Backup approach: Check for files in event_files table linked to the booking ID
    if (createdFileRecords.length === 0) {
      console.log('No direct file found, checking event_files table for booking files');
      
      const { data: bookingFiles, error: fetchError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', bookingId);
        
      if (fetchError) {
        console.error('Error fetching booking files from event_files:', fetchError);
        return createdFileRecords;
      }
      
      console.log(`Found ${bookingFiles?.length || 0} files in event_files table for booking`, bookingFiles);
      
      if (!bookingFiles || bookingFiles.length === 0) {
        console.log('No files found in event_files table');
        return createdFileRecords;
      }
      
      // Process each file from event_files
      for (const file of bookingFiles) {
        try {
          if (!file.file_path || typeof file.file_path !== 'string') {
            console.error('File has no valid file_path, skipping:', file);
            continue;
          }
          
          console.log(`Processing file from event_files: ${file.filename}, path: ${file.file_path}`);
          
          // Download the file from booking_attachments
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('booking_attachments')
            .download(normalizeFilePath(file.file_path));
            
          if (downloadError || !fileData) {
            console.error('Error downloading file from booking_attachments:', downloadError);
            continue;
          }
          
          // Generate a new unique file path for event_attachments
          const fileNameStr = typeof file.filename === 'string' ? file.filename : 'file';
          const fileExt = fileNameStr.split('.').pop() || 'bin';
          const newFilePath = `${eventId}/${crypto.randomUUID()}.${fileExt}`;
          
          // Upload to event_attachments
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(newFilePath, fileData, { 
              contentType: typeof file.content_type === 'string' ? file.content_type : 'application/octet-stream' 
            });
            
          if (uploadError) {
            console.error('Error uploading file to event_attachments:', uploadError);
            continue;
          }
          
          console.log(`Successfully copied file to event_attachments/${newFilePath}`);
          
          // Create event_files record
          const { data: eventFile, error: eventFileError } = await supabase
            .from('event_files')
            .insert({
              filename: typeof file.filename === 'string' ? file.filename : 'file',
              file_path: newFilePath,
              content_type: typeof file.content_type === 'string' ? file.content_type : 'application/octet-stream',
              size: typeof file.size === 'number' ? file.size : 0,
              user_id: userId,
              event_id: eventId,
              source: 'booking_request'
            })
            .select()
            .single();
            
          if (eventFileError) {
            console.error('Error creating event file record:', eventFileError);
          } else {
            console.log('Created event file record:', eventFile);
            createdFileRecords.push(eventFile);
          }
        } catch (error) {
          console.error('Error processing file:', error);
        }
      }
    }
    
    return createdFileRecords;
  } catch (error) {
    console.error('Error in associateBookingFilesWithEvent:', error);
    return [];
  }
};
