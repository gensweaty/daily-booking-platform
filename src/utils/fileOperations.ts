import { supabase } from "@/lib/supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const validateFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE) {
    return "File size exceeds the 5MB limit.";
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Invalid file type. Allowed types: PDF, JPG, PNG.";
  }
  return null;
};

export const uploadEventFile = async (file: File, eventId: string) => {
  const fileExt = file.name.split('.').pop();
  const filePath = `${crypto.randomUUID()}.${fileExt}`;
  
  try {
    const { error: uploadError } = await supabase.storage
      .from('event_attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: fileRecordError } = await supabase
      .from('event_files')
      .insert({
        event_id: eventId,
        filename: file.name,
        file_path: filePath,
        content_type: file.type,
        size: file.size,
      });

    if (fileRecordError) {
      await cleanUpFile(filePath);
      throw fileRecordError;
    }

    return filePath;
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};

export const cleanUpFile = async (filePath: string) => {
  try {
    await supabase.storage
      .from('event_attachments')
      .remove([filePath]);
  } catch (error) {
    console.error('Failed to clean up file:', error);
  }
};