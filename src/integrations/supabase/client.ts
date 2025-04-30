
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { BookingRequest, EventFile } from '@/types/database';

const supabaseUrl = "https://mrueqpffzauvdxmuwhfa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper function to normalize file paths by removing any potential starting slash
export const normalizeFilePath = (path: string): string => {
  if (!path) return '';
  return path.startsWith('/') ? path.substring(1) : path;
};

// Helper function to get the storage URL - Fixed to use hardcoded URL instead of process.env
export const getStorageUrl = () => {
  return `${supabaseUrl}/storage/v1`;
};

// Function to associate uploaded files with events/bookings
export const associateFileWithEvent = async (file: File, eventId: string, userId: string) => {
  try {
    // Generate a unique file path - better structure for consistent access
    const fileExt = file.name.split('.').pop();
    const filePath = `${eventId}/${crypto.randomUUID()}.${fileExt}`;
    
    console.log(`Uploading file ${file.name} to event_attachments/${filePath}`);
    
    // Upload to event_attachments bucket
    const { error: uploadError } = await supabase.storage
      .from('event_attachments')
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

// Helper function to associate booking files with event (enhanced)
export const associateBookingFilesWithEvent = async (
  bookingId: string, 
  eventId: string, 
  userId: string
): Promise<EventFile[]> => {
  try {
    console.log(`Associating files from booking ${bookingId} with event ${eventId}`);
    const createdFileRecords: EventFile[] = [];
    
    // 1. First check if there are any files in event_files table with booking ID as event_id
    const { data: existingFiles, error: existingFilesError } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', bookingId);
      
    if (existingFilesError) {
      console.error('Error fetching existing booking files:', existingFilesError);
    } else if (existingFiles && existingFiles.length > 0) {
      console.log(`Found ${existingFiles.length} files in event_files with booking ID ${bookingId}`);
      
      // Create new event_files records linking to the event
      for (const file of existingFiles) {
        try {
          // Get the actual file data from storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('event_attachments')
            .download(normalizeFilePath(file.file_path));

          if (downloadError) {
            console.error(`Error downloading existing file ${file.filename}:`, downloadError);
            continue;
          }

          // Create a new file path for the event
          const fileExtension = file.filename.includes('.') ? 
            file.filename.split('.').pop() || 'bin' : 'bin';
          
          const newFilePath = `${eventId}/${crypto.randomUUID()}.${fileExtension}`;
          
          // Upload to event_attachments with the new path
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(newFilePath, fileData, { 
              contentType: file.content_type || 'application/octet-stream' 
            });
            
          if (uploadError) {
            console.error('Error uploading file to event_attachments:', uploadError);
            continue;
          }

          // Create new event_files record
          const { data: newEventFile, error: newEventFileError } = await supabase
            .from('event_files')
            .insert({
              filename: file.filename,
              file_path: newFilePath, // Use the NEW path
              content_type: file.content_type,
              size: file.size,
              user_id: userId,
              event_id: eventId,
              source: 'booking_request'
            })
            .select()
            .single();
            
          if (newEventFileError) {
            console.error('Error creating event file record:', newEventFileError);
          } else if (newEventFile) {
            console.log(`Created new event file record for ${file.filename}`);
            createdFileRecords.push(newEventFile as EventFile);
          }
        } catch (error) {
          console.error(`Error processing file ${file.filename}:`, error);
        }
      }
    }
    
    // 2. Check for direct file fields in booking_requests
    const { data: bookingData, error: bookingError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();
      
    if (bookingError) {
      console.error('Error fetching booking request data:', bookingError);
    } else if (bookingData) {
      const booking = bookingData as BookingRequest;
      
      if (booking && booking.file_path && booking.filename) {
        try {
          console.log(`Processing direct file from booking_requests: ${booking.filename}, path: ${booking.file_path}`);
          
          // Download the file from booking_attachments
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('booking_attachments')
            .download(normalizeFilePath(booking.file_path));
            
          if (downloadError) {
            console.error('Error downloading file from booking_attachments:', downloadError);
          } else if (fileData) {
            // Generate a new unique file path for event_attachments that includes the event ID for better organization
            const fileExtension = booking.filename.includes('.') ? 
              booking.filename.split('.').pop() || 'bin' : 'bin';
            
            const newFilePath = `${eventId}/${crypto.randomUUID()}.${fileExtension}`;
            
            // Upload to event_attachments
            const { error: uploadError } = await supabase.storage
              .from('event_attachments')
              .upload(newFilePath, fileData, { 
                contentType: booking.content_type || 'application/octet-stream' 
              });
              
            if (uploadError) {
              console.error('Error uploading file to event_attachments:', uploadError);
            } else {
              console.log(`Successfully copied file to event_attachments/${newFilePath}`);
              
              // Create event_files record
              const { data: eventFile, error: eventFileError } = await supabase
                .from('event_files')
                .insert({
                  filename: booking.filename,
                  file_path: newFilePath,
                  content_type: booking.content_type || 'application/octet-stream',
                  size: booking.size || 0,
                  user_id: userId,
                  event_id: eventId,
                  source: 'booking_request'
                })
                .select()
                .single();
                
              if (eventFileError) {
                console.error('Error creating event file record:', eventFileError);
              } else if (eventFile) {
                console.log('Created event file record:', eventFile);
                createdFileRecords.push(eventFile as EventFile);
                
                // Create a customer file record as well if possible
                try {
                  // First find the customer
                  const { data: customers } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('user_id', userId)
                    .filter('title', 'eq', booking.requester_name)
                    .limit(1);
                  
                  if (customers && customers.length > 0) {
                    const customerId = customers[0].id;
                    
                    // Create customer file record
                    const { error: customerFileError } = await supabase
                      .from('customer_files_new')
                      .insert({
                        customer_id: customerId,
                        filename: booking.filename,
                        file_path: newFilePath, // Use the same path for consistency
                        content_type: booking.content_type || 'application/octet-stream',
                        size: booking.size || 0,
                        user_id: userId,
                        source: 'booking_request'
                      });
                      
                    if (customerFileError) {
                      console.error('Error creating customer file record:', customerFileError);
                    } else {
                      console.log('Created customer file record for the same file');
                    }
                  }
                } catch (error) {
                  console.error('Error handling customer file creation:', error);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing direct booking file:', error);
        }
      } else {
        console.log('No direct file found on booking request row');
      }
    }
    
    return createdFileRecords;
  } catch (error) {
    console.error('Error in associateBookingFilesWithEvent:', error);
    return [];
  }
};
