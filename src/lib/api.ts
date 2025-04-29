
// File handling functions
import { supabase } from "./supabase";
import type { FileRecord } from "@/types/files";

/**
 * Get all files for an event by event ID
 */
export async function getEventFiles(eventId: string): Promise<FileRecord[]> {
  try {
    console.log(`Fetching files for event ID: ${eventId}`);
    const { data, error } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', eventId);
      
    if (error) {
      console.error('Error fetching event files:', error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} files for event`);
    return data || [];
  } catch (error) {
    console.error('Exception in getEventFiles:', error);
    return [];
  }
}

/**
 * Get the download URL for a file
 */
export function getFileUrl(filePath: string, bucket: string = 'event_attachments'): string {
  return supabase.storage
    .from(bucket)
    .getPublicUrl(filePath).data.publicUrl;
}

/**
 * Delete a file from both storage and database
 */
export async function deleteFile(
  file: FileRecord, 
  bucket: string = 'event_attachments'
): Promise<boolean> {
  try {
    // First remove from storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([file.file_path]);
      
    if (storageError) {
      console.error('Error removing file from storage:', storageError);
      // Continue anyway to try removing the database record
    }
    
    // Then remove database record
    const { error: dbError } = await supabase
      .from('event_files')
      .delete()
      .eq('id', file.id);
      
    if (dbError) {
      console.error('Error removing file record from database:', dbError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception in deleteFile:', error);
    return false;
  }
}
