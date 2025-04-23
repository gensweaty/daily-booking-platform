
import { normalizeFilePath, getStorageUrl } from "./client";

// Helper function to determine which storage bucket to use based on file path
export const determineEffectiveBucket = (filePath: string): string => {
  // Check if this is a public URL
  if (filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'))) {
    console.log("File path is a public URL:", filePath);
    // This is not a local Supabase file, so bucket is irrelevant
    return ''; 
  }
  
  return "event_attachments"; // Default to event_attachments
};

// Helper function to get the direct file URL
export const getDirectFileUrl = (filePath: string): string => {
  if (!filePath) return '';
  
  // Special handling for fully qualified URLs (public links)
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  
  const normalizedPath = normalizeFilePath(filePath);
  let effectiveBucket = determineEffectiveBucket(filePath);
  
  console.log(`Using bucket ${effectiveBucket} for path ${filePath}`);
  
  return `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
};

// Create a utility function to construct file objects from event data
export const createFileObjectFromEvent = (event: any): any[] => {
  if (!event) return [];
  
  // Check if the event has file_path and filename directly
  if (event.file_path && event.filename) {
    console.log(`Creating file object from event: ${event.id} with file path: ${event.file_path}`);
    return [{
      id: `event-file-${event.id}`,
      file_path: event.file_path,
      filename: event.filename,
      content_type: '',
      size: 0,
      created_at: event.created_at,
      user_id: event.user_id
    }];
  }
  
  // Check if the event has event_files collection
  if (event.event_files && event.event_files.length > 0) {
    console.log(`Found ${event.event_files.length} files in event ${event.id}`);
    return event.event_files;
  }

  // For approved booking requests, the file information would be on the original booking
  if (event.booking_request_id) {
    console.log(`Event ${event.id} is from booking request ${event.booking_request_id}, checking for files`);
    // The file data should have been copied to the event itself, but we log this for debugging purposes
  }
  
  console.log(`No files found for event ${event.id}`);
  return [];
};
