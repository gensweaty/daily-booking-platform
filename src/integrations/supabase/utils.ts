
import { normalizeFilePath, getStorageUrl } from "./client";

// Helper function to determine which storage bucket to use based on file path and entity type
export const determineEffectiveBucket = (filePath: string, parentType?: string, source?: string): string => {
  // Check if this is a public URL
  if (filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'))) {
    console.log("File path is a public URL:", filePath);
    // This is not a local Supabase file, so bucket is irrelevant
    return ''; 
  }
  
  if (source === 'event' || source === 'booking_request') {
    return "event_attachments";
  }
  
  if (source === 'customer') {
    return "customer_attachments";
  }
  
  if (filePath && (
    filePath.includes("b22b") || 
    /^\d{13}_/.test(filePath) || 
    filePath.includes("event_") ||
    filePath.startsWith("event/")
  )) {
    return "event_attachments";
  }
  
  if (parentType === "customer" && filePath && 
    !filePath.includes("b22b") && 
    !/^\d{13}_/.test(filePath) &&
    !filePath.includes("event_") &&
    !filePath.startsWith("event/")) {
    return "customer_attachments";
  }
  
  if (parentType === "event") {
    return "event_attachments";
  }
  
  return "event_attachments"; // Default to event_attachments
};

// Helper function to get the direct file URL
export const getDirectFileUrl = (filePath: string, fileId: string, parentType?: string): string => {
  if (!filePath) return '';
  
  // Special handling for fully qualified URLs (public links)
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  
  const normalizedPath = normalizeFilePath(filePath);
  const effectiveBucket = determineEffectiveBucket(filePath, parentType);
  console.log(`Using bucket ${effectiveBucket} for path ${filePath}`);
  
  return `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
};
