
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
  // This ensures files are fetched from the correct bucket based on their original source
  if (source) {
    if (['event', 'booking_request', 'booking_files'].includes(source)) {
      return "event_attachments";
    }
    
    if (source === 'customer') {
      return "customer_attachments";
    }
  }
  
  // Then check file path patterns
  if (filePath && (
    filePath.includes("b22b") || 
    /^\d{13}_/.test(filePath) || 
    filePath.includes("event_") ||
    filePath.startsWith("event/") ||
    filePath.includes("booking_")
  )) {
    // Check specifically for booking paths
    if (filePath.includes("booking_")) {
      console.log("Using booking_attachments bucket for booking-related file:", filePath);
      return "booking_attachments";
    }
    
    return "event_attachments";
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
    return "event_attachments";
  }
  
  // Default fallback
  return "event_attachments";
};

// Helper function to get the direct file URL
export const getDirectFileUrl = (filePath: string, fileId: string, parentType?: string, source?: string): string => {
  if (!filePath) return '';
  
  // Special handling for fully qualified URLs (public links)
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  
  const normalizedPath = normalizeFilePath(filePath);
  // Pass the source parameter to determineEffectiveBucket to use the correct bucket
  let effectiveBucket = determineEffectiveBucket(filePath, parentType, source);
  
  // Special handling for booking files
  if (filePath.includes("booking_") || source === "booking_request" || source === "booking_files") {
    console.log(`Using booking_attachments bucket for booking file: ${filePath} (source: ${source || 'unknown'})`);
    effectiveBucket = "booking_attachments";
  }
  
  console.log(`Using bucket ${effectiveBucket} for path ${filePath} (source: ${source || 'unknown'})`);
  
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
