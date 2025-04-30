
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

// Function to associate booking files with events (for backward compatibility)
export async function associateBookingFilesWithEvent(
  bookingId: string, 
  eventId: string, 
  userId: string
) {
  try {
    console.log(`Associating files from booking ${bookingId} to event ${eventId}`);
    
    // Check for existing files attached to the booking request
    const { data: bookingFiles, error: filesError } = await supabase
      .from('booking_files')
      .select('*')
      .eq('booking_request_id', bookingId);
    
    if (filesError) {
      console.error('Error fetching booking files:', filesError);
      return null;
    }
    
    if (!bookingFiles || bookingFiles.length === 0) {
      console.log('No files found in booking_files table, checking for legacy file data');
      
      // Check for legacy file data in booking_requests table
      const { data: bookingRequest, error: bookingError } = await supabase
        .from('booking_requests')
        .select('file_path, filename, content_type, size')
        .eq('id', bookingId)
        .single();
        
      if (bookingError || !bookingRequest || !bookingRequest.file_path) {
        console.log('No files found for this booking request');
        return null;
      }
      
      // Handle legacy file data
      try {
        // Download the original file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('event_attachments') // Legacy files were stored in event_attachments
          .download(bookingRequest.file_path);
          
        if (downloadError) {
          console.error('Error downloading legacy file:', downloadError);
          return null;
        }
        
        if (!fileData) {
          console.error('No data returned when downloading legacy file');
          return null;
        }
        
        // Generate a new path for the file in the event_attachments bucket
        const fileExt = bookingRequest.filename.split('.').pop();
        const newFilePath = `event_${eventId}_${Date.now()}.${fileExt}`;
        
        // Upload the file to the event_attachments bucket
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(newFilePath, fileData);
          
        if (uploadError) {
          console.error('Error uploading file to event_attachments:', uploadError);
          return null;
        }
        
        // Create event_files record
        const { data: eventFile, error: eventFileError } = await supabase
          .from('event_files')
          .insert({
            filename: bookingRequest.filename,
            file_path: newFilePath,
            content_type: bookingRequest.content_type || null,
            size: bookingRequest.size || null,
            user_id: userId,
            event_id: eventId
          })
          .select()
          .single();
          
        if (eventFileError) {
          console.error('Error creating event file record:', eventFileError);
          return null;
        }
        
        console.log('Successfully created event file from legacy booking file data:', eventFile);
        return eventFile;
      } catch (error) {
        console.error('Error processing legacy file:', error);
        return null;
      }
    }
    
    console.log(`Found ${bookingFiles.length} files to transfer from booking to event`);
    
    // Process all files from the booking request
    const eventFiles = [];
    
    for (const file of bookingFiles) {
      try {
        console.log(`Processing file: ${file.filename}, path: ${file.file_path}`);
        
        // Download the file from booking_attachments bucket
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('booking_attachments')
          .download(file.file_path);
          
        if (downloadError) {
          console.error('Error downloading file from booking_attachments:', downloadError);
          continue;
        }
        
        if (!fileData) {
          console.error('No data returned when downloading file');
          continue;
        }
        
        // Generate a new path for the file in event_attachments bucket
        const fileExt = file.filename.split('.').pop();
        const newFilePath = `event_${eventId}_${Date.now()}.${fileExt}`;
        
        // Upload to event_attachments bucket
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(newFilePath, fileData);
          
        if (uploadError) {
          console.error('Error uploading file to event_attachments:', uploadError);
          continue;
        }
        
        console.log('File successfully copied from booking_attachments to event_attachments:', newFilePath);
        
        // Create an event file record pointing to the new storage location
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
          eventFiles.push(eventFile);
          console.log('Created event file record successfully:', eventFile);
        }
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
    
    return eventFiles.length > 0 ? eventFiles[0] : null;
  } catch (error) {
    console.error('Error in associateBookingFilesWithEvent:', error);
    return null;
  }
}

// Function to create storage buckets if they don't exist
export async function ensureStorageBuckets() {
  try {
    // Check if event_attachments bucket exists
    const { data: bucketData, error: bucketError } = await supabase
      .storage
      .getBucket('event_attachments');
    
    // If bucket doesn't exist, create it
    if (bucketError && bucketError.message.includes('does not exist')) {
      console.log('Creating event_attachments storage bucket');
      const { data, error } = await supabase
        .storage
        .createBucket('event_attachments', { public: true });
      
      if (error) {
        console.error('Error creating event_attachments bucket:', error);
      } else {
        console.log('Successfully created event_attachments bucket');
      }
    }
    
    // Check if booking_attachments bucket exists
    const { data: bookingBucketData, error: bookingBucketError } = await supabase
      .storage
      .getBucket('booking_attachments');
    
    // If bucket doesn't exist, create it
    if (bookingBucketError && bookingBucketError.message.includes('does not exist')) {
      console.log('Creating booking_attachments storage bucket');
      const { data, error } = await supabase
        .storage
        .createBucket('booking_attachments', { public: true });
      
      if (error) {
        console.error('Error creating booking_attachments bucket:', error);
      } else {
        console.log('Successfully created booking_attachments bucket');
      }
    }
  } catch (error) {
    console.error('Error ensuring storage buckets exist:', error);
  }
}

// Call this function when the app initializes
ensureStorageBuckets();
