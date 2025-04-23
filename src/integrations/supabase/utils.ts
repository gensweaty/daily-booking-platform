
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
