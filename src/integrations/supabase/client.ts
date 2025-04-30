
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = "https://mrueqpffzauvdxmuwhfa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper function to normalize file paths by removing any potential starting slash
export const normalizeFilePath = (path: string): string => {
  return path.startsWith('/') ? path.substring(1) : path;
};

// Helper function to get the storage URL
export const getStorageUrl = (): string => {
  return `${supabaseUrl}/storage/v1`;
};

// Helper for checking if a file exists in storage
export const checkIfFileExists = async (bucket: string, filePath: string): Promise<boolean> => {
  try {
    const normalizedPath = normalizeFilePath(filePath);
    const folderPath = normalizedPath.split('/').slice(0, -1).join('/');
    const fileName = normalizedPath.split('/').pop() || '';
    
    console.log(`Checking if file exists in storage: ${bucket}/${folderPath} - filename: ${fileName}`);
    
    // List files in the directory to see if our file is there
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folderPath, {
        limit: 100,
        offset: 0,
        search: fileName
      });
      
    if (error) {
      console.error('Error checking if file exists:', error);
      return false;
    }
    
    return data?.some(item => item.name === fileName) || false;
  } catch (error) {
    console.error('Error in checkIfFileExists:', error);
    return false;
  }
};
