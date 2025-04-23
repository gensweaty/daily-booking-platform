
import { normalizeFilePath, getStorageUrl } from "./client";

// Helper function to determine which storage bucket to use based on file path and entity type
export const determineEffectiveBucket = (filePath: string, parentType?: string, source?: string): string => {
  // Check if this is a public URL
  if (filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'))) {
    console.log("File path is a public URL:", filePath);
    // This is not a local Supabase file, so bucket is irrelevant
    return ''; 
  }
  
  // First, prioritize source parameter if provided
  if (source) {
    if (source === 'booking_request' || source === 'booking_files' || source === 'event') {
      console.log(`Using event_attachments bucket based on source: ${source}`);
      return "event_attachments";
    }
    
    if (source === 'customer') {
      console.log(`Using customer_attachments bucket based on source: ${source}`);
      return "customer_attachments";
    }
  }
  
  // Then check file path patterns
  if (filePath) {
    // Check specifically for booking paths
    if (filePath.includes("booking_")) {
      console.log("Using event_attachments bucket for booking-related file:", filePath);
      return "event_attachments";
    }
    
    if (filePath.includes("b22b") || 
        /^\d{13}_/.test(filePath) || 
        filePath.includes("event_") ||
        filePath.startsWith("event/")) {
      console.log("Using event_attachments bucket based on path pattern:", filePath);
      return "event_attachments";
    }
  }
  
  // Then check parent type
  if (parentType === "customer" && filePath && 
    !filePath.includes("b22b") && 
    !/^\d{13}_/.test(filePath) &&
    !filePath.includes("event_") &&
    !filePath.startsWith("event/") &&
    !filePath.includes("booking_")) {
    return "customer_attachments";
  }
  
  if (parentType === "event" || parentType === "booking_request") {
    console.log(`Using event_attachments bucket based on parentType: ${parentType}`);
    return "event_attachments";
  }
  
  // Default fallback
  console.log("Using default event_attachments bucket");
  return "event_attachments";
};

// Helper function to get the direct file URL
export const getDirectFileUrl = (filePath: string, fileId: string, parentType?: string, source?: string): string => {
  if (!filePath) {
    console.log("Empty file path provided to getDirectFileUrl");
    return '';
  }
  
  // Special handling for fully qualified URLs (public links)
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    console.log("Using direct public URL:", filePath);
    return filePath;
  }
  
  const normalizedPath = normalizeFilePath(filePath);
  const effectiveBucket = determineEffectiveBucket(filePath, parentType, source);
  
  console.log(`[getDirectFileUrl] Using bucket ${effectiveBucket} for path ${filePath} (source: ${source || 'unknown'})`);
  
  return `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
};

// Generic function for safely calling supabase.from() with type casting
export const safeSupabaseQuery = async <T>(
  tableName: string, 
  queryBuilder: (query: any) => any
): Promise<{ data: T[] | null; error: any }> => {
  try {
    // Import supabase here to avoid circular dependencies
    const { supabase } = await import("./client");
    
    // Use type assertion to bypass TypeScript's type checking for dynamic table names
    const query = supabase.from(tableName as any);
    
    // Apply the query builder function
    const result = await queryBuilder(query);
    
    return result;
  } catch (error) {
    console.error(`Error in safeSupabaseQuery for table ${tableName}:`, error);
    return { data: null, error };
  }
};
