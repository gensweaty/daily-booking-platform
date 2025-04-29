
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = "https://mrueqpffzauvdxmuwhfa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper function to normalize file paths by removing any potential starting slash
export const normalizeFilePath = (path: string): string => {
  if (!path) return '';
  return path.startsWith('/') ? path.substring(1) : path;
};

// Helper function to clean file paths to ensure they don't include bucket name prefix
export const cleanFilePath = (filePath: string, bucketName: string): string => {
  if (!filePath) return '';
  
  // Remove bucket prefix if present
  if (filePath.startsWith(`${bucketName}/`)) {
    return filePath.substring(bucketName.length + 1);
  }
  
  return normalizeFilePath(filePath);
};

// Helper function to get the storage URL
export const getStorageUrl = (): string => {
  return `${supabaseUrl}/storage/v1`;
};
