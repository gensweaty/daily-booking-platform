import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = "https://mrueqpffzauvdxmuwhfa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper function to normalize file paths by removing any potential starting slash
export const normalizeFilePath = (path: string): string => {
  if (!path) return '';
  
  // Log original path for debugging
  console.log("Normalizing file path:", path);
  
  // If path already contains a bucket name, extract just the file path
  const bucketNames = ['event_attachments', 'booking_attachments', 'customer_attachments', 
                       'note_attachments', 'task_attachments'];
  
  for (const bucket of bucketNames) {
    if (path.startsWith(`${bucket}/`)) {
      const cleanedPath = path.substring(bucket.length + 1);
      console.log(`Extracted file path from ${path} to ${cleanedPath}`);
      return cleanedPath;
    }
  }
  
  // Otherwise just remove any starting slash
  return path.startsWith('/') ? path.substring(1) : path;
};

// Helper function to clean file paths to ensure they don't include bucket name prefix
export const cleanFilePath = (filePath: string, bucketName: string): string => {
  if (!filePath) return '';
  
  console.log(`Cleaning file path: ${filePath} with bucket: ${bucketName}`);
  
  // Remove bucket prefix if present
  if (filePath.startsWith(`${bucketName}/`)) {
    const cleanedPath = filePath.substring(bucketName.length + 1);
    console.log(`Cleaned file path from ${filePath} to ${cleanedPath}`);
    return cleanedPath;
  }
  
  // Also check for URL format paths
  const urlBucketPattern = new RegExp(`/storage/v1/object/public/${bucketName}/(.+)$`);
  const urlMatch = filePath.match(urlBucketPattern);
  if (urlMatch && urlMatch[1]) {
    console.log(`Extracted file path from URL ${filePath} to ${urlMatch[1]}`);
    return urlMatch[1];
  }
  
  // Otherwise normalize any path
  return normalizeFilePath(filePath);
};

// Helper function to get the storage URL
export const getStorageUrl = (): string => {
  return `${supabaseUrl}/storage/v1`;
};
