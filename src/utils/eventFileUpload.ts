import { supabase } from "@/lib/supabase";

export interface UploadFilesOptions {
  files: File[];
  eventId: string;
  userId: string;
  isPublicMode?: boolean;
}

/**
 * Upload files to event_attachments storage and create records in event_files table
 * @param options - Upload configuration including files, eventId, userId, and context
 * @returns Promise that resolves when all files are uploaded
 */
export const uploadEventFiles = async (options: UploadFilesOptions): Promise<void> => {
  const { files, eventId, userId, isPublicMode = false } = options;
  
  if (files.length === 0) return;
  
  console.log(`📤 [${isPublicMode ? 'Public' : 'Internal'}] Uploading ${files.length} files for event:`, eventId);
  
  const uploadPromises = files.map(async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${eventId}/${Date.now()}.${fileExt}`;
    
    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('event_attachments')
      .upload(fileName, file);

    if (uploadError) {
      console.error(`❌ [${isPublicMode ? 'Public' : 'Internal'}] Error uploading file:`, uploadError);
      return null;
    }

    // Create record in event_files table
    const { error: dbError } = await supabase
      .from('event_files')
      .insert({
        filename: file.name,
        file_path: fileName,
        content_type: file.type,
        size: file.size,
        user_id: userId, // Always use the provided userId (board owner for public events)
        event_id: eventId
      });

    if (dbError) {
      console.error(`❌ [${isPublicMode ? 'Public' : 'Internal'}] Error saving file record:`, dbError);
      return null;
    }

    console.log(`✅ [${isPublicMode ? 'Public' : 'Internal'}] File uploaded successfully:`, file.name);
    return fileName;
  });

  await Promise.all(uploadPromises);
  console.log(`✅ [${isPublicMode ? 'Public' : 'Internal'}] All files uploaded successfully for event:`, eventId);
};

/**
 * Load existing files for an event from the event_files table
 * @param eventId - The event ID to load files for
 * @returns Promise that resolves to an array of file records
 */
export const loadEventFiles = async (eventId: string) => {
  try {
    console.log('🔍 Loading existing files for event:', eventId);

    const { data: eventFiles, error } = await supabase
      .from('event_files')
      .select('*')
      .eq('event_id', eventId);

    if (error) {
      console.error('❌ Error loading event files:', error);
      return [];
    }

    console.log('✅ Loaded existing files:', eventFiles?.length || 0, 'files for event:', eventId);
    return eventFiles || [];
  } catch (error) {
    console.error('❌ Error loading existing files:', error);
    return [];
  }
};