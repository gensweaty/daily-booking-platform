
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
  
  let files = [];
  
  // Check if the event has event_files collection
  if (event.event_files && event.event_files.length > 0) {
    console.log(`Found ${event.event_files.length} files in event ${event.id}`);
    files = [...event.event_files];
  }
  
  // Check if the event has direct file_path and filename
  if (event.file_path && event.filename) {
    console.log(`Event ${event.id} has direct file: ${event.filename} (${event.file_path})`);
    files.push({
      id: `event-file-${event.id}`,
      file_path: event.file_path,
      filename: event.filename,
      content_type: '',
      size: 0,
      created_at: event.created_at,
      user_id: event.user_id
    });
  }
  
  // For approved booking requests, check if we need to log anything
  if (event.booking_request_id) {
    console.log(`Event ${event.id} is from booking request ${event.booking_request_id}, checking for files`);
    // Files from booking requests should already be copied to the event itself
  }
  
  if (files.length === 0) {
    console.log(`No files found for event ${event.id}`);
  }
  
  return files;
};
