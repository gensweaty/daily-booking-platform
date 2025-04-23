
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = "https://mrueqpffzauvdxmuwhfa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper function to normalize file path by removing prefixes
export const normalizeFilePath = (path: string): string => {
  if (!path) return '';
  
  // Remove any leading directory prefixes
  if (path.startsWith('event/')) {
    return path.substring('event/'.length);
  }
  
  // Handle public paths
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Extract filename from URL for public links
    try {
      const url = new URL(path);
      const pathParts = url.pathname.split('/');
      return pathParts[pathParts.length - 1];
    } catch (e) {
      return path;
    }
  }
  
  return path;
};

// Helper to get the storage URL for supabase
export const getStorageUrl = () => {
  return `${supabaseUrl}/storage/v1`;
};
