
import { supabase } from "@/integrations/supabase/client";
import { FileRecord } from "@/types/files";
import { useQueryClient } from "@tanstack/react-query";

// Standardized storage bucket names
export const STORAGE_BUCKETS = {
  EVENT: 'event_attachments',
  BOOKING: 'booking_attachments',
  NOTE: 'note_attachments',
  TASK: 'task_attachments'
};

// Helper to normalize file paths (handle double slashes)
export const normalizeFilePath = (filePath: string): string => {
  if (!filePath) return "";
  // Remove any leading slashes
  return filePath.replace(/^\/+/, '');
};

// Get the storage URL for constructing file URLs
export const getStorageUrl = (): string => {
  return `${import.meta.env.VITE_SUPABASE_URL || "https://mrueqpffzauvdxmuwhfa.supabase.co"}/storage/v1`;
};

// Get a consistent file URL regardless of input bucket - always uses the actual bucket where file is stored
export const getFileUrl = (filePath: string, providedBucket: string = STORAGE_BUCKETS.EVENT): string => {
  if (!filePath) return '';
  
  // For consistency, always use the EVENT bucket since that's where we store all files
  const effectiveBucket = STORAGE_BUCKETS.EVENT;
  
  const normalizedPath = normalizeFilePath(filePath);
  return `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
};

// Upload a file to a specified bucket (defaults to event_attachments)
export const uploadFile = async (
  file: File, 
  parentId: string, 
  userId: string
): Promise<FileRecord | null> => {
  try {
    // Generate a unique file path with parent ID prefix for better organization
    const fileExt = file.name.split('.').pop();
    const filePath = `${parentId}/${crypto.randomUUID()}.${fileExt}`;
    
    console.log(`Uploading file ${file.name} to ${STORAGE_BUCKETS.EVENT}/${filePath}`);
    
    // Upload to event_attachments bucket
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.EVENT)
      .upload(filePath, file);
      
    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }
    
    return {
      id: crypto.randomUUID(),
      filename: file.name,
      file_path: filePath,
      content_type: file.type,
      size: file.size,
      user_id: userId,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in uploadFile:', error);
    return null;
  }
};

// Delete a file from storage and remove its database record
export const deleteFile = async (filePath: string, fileId: string, parentType: string): Promise<boolean> => {
  try {
    if (!filePath) {
      throw new Error('File path is required for deletion');
    }

    console.log(`Deleting file from bucket ${STORAGE_BUCKETS.EVENT}, path: ${filePath}`);
    
    // Remove from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKETS.EVENT)
      .remove([normalizeFilePath(filePath)]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      throw storageError;
    }
    
    // Determine the appropriate table name based on the parent type
    let tableName: "event_files" | "customer_files_new" | "note_files" | "files" = "event_files";
    
    if (parentType === 'customer') {
      tableName = "customer_files_new";
    } else if (parentType === 'note') {
      tableName = "note_files";
    } else if (parentType === 'task') {
      tableName = "files";
    }
    
    console.log(`Deleting file record from table ${tableName}, id: ${fileId}`);
    const { error: dbError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', fileId);
      
    if (dbError) {
      console.error(`Error deleting file from ${tableName}:`, dbError);
      throw dbError;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteFile:', error);
    return false;
  }
};

// Create a file record in the database
export const createFileRecord = async (
  fileData: Omit<FileRecord, 'id' | 'created_at'>,
  parentType: 'event' | 'customer' | 'note' | 'task'
): Promise<FileRecord | null> => {
  try {
    // Determine the table based on parent type
    let tableName: "event_files" | "customer_files_new" | "note_files" | "files" = "event_files";
    let parentIdField: string = 'event_id';
    
    if (parentType === 'customer') {
      tableName = "customer_files_new";
      parentIdField = 'customer_id';
    } else if (parentType === 'note') {
      tableName = "note_files";
      parentIdField = 'note_id';
    } else if (parentType === 'task') {
      tableName = "files";
      parentIdField = 'task_id';
    }
    
    // Create the database record
    const { data, error } = await supabase
      .from(tableName)
      .insert({
        filename: fileData.filename,
        file_path: fileData.file_path,
        content_type: fileData.content_type,
        size: fileData.size,
        user_id: fileData.user_id,
        [parentIdField]: fileData[parentType === 'event' ? 'event_id' : 
                                 parentType === 'customer' ? 'customer_id' :
                                 parentType === 'note' ? 'note_id' : 'task_id']
      })
      .select()
      .single();
      
    if (error) {
      console.error(`Error creating file record in ${tableName}:`, error);
      throw error;
    }
    
    return data as FileRecord;
  } catch (error) {
    console.error('Error in createFileRecord:', error);
    return null;
  }
};

// Helper function to associate files with an entity
export const associateFilesWithEntity = async (
  sourceId: string,
  targetId: string,
  userId: string,
  sourceType: 'booking' | 'event' | 'customer',
  targetType: 'event' | 'customer'
): Promise<FileRecord[]> => {
  try {
    console.log(`Associating files from ${sourceType} ${sourceId} with ${targetType} ${targetId}`);
    const createdFileRecords: FileRecord[] = [];
    
    // Source table name based on source type
    let sourceTable = sourceType === 'booking' ? 'booking_requests' : 
                      sourceType === 'event' ? 'events' : 'customers';
    
    // First, check if there are any files in the corresponding files table with the source ID
    const fileTable = sourceType === 'booking' || sourceType === 'event' ? 'event_files' :
                      sourceType === 'customer' ? 'customer_files_new' : '';
    
    if (!fileTable) {
      console.error(`Invalid source type: ${sourceType}`);
      return [];
    }
    
    // Get files from the source entity
    const { data: existingFiles, error: existingFilesError } = await supabase
      .from(fileTable)
      .select('*')
      .eq(sourceType === 'booking' || sourceType === 'event' ? 'event_id' : 'customer_id', sourceId);
      
    if (existingFilesError) {
      console.error(`Error fetching ${sourceType} files:`, existingFilesError);
      return [];
    }
    
    // Process each file by copying it to the new entity
    if (existingFiles && existingFiles.length > 0) {
      console.log(`Found ${existingFiles.length} files in ${fileTable} for ${sourceType} ${sourceId}`);
      
      for (const file of existingFiles) {
        try {
          // Get the actual file data from storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(STORAGE_BUCKETS.EVENT)
            .download(normalizeFilePath(file.file_path));

          if (downloadError) {
            console.error(`Error downloading existing file ${file.filename}:`, downloadError);
            continue;
          }

          // Create a new file path for the target entity
          const fileExtension = file.filename.includes('.') ? 
            file.filename.split('.').pop() || 'bin' : 'bin';
          
          const newFilePath = `${targetId}/${crypto.randomUUID()}.${fileExtension}`;
          
          // Upload to event_attachments with the new path
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKETS.EVENT)
            .upload(newFilePath, fileData, { 
              contentType: file.content_type || 'application/octet-stream' 
            });
            
          if (uploadError) {
            console.error(`Error uploading file to ${STORAGE_BUCKETS.EVENT}:`, uploadError);
            continue;
          }

          // Create new record in the target files table
          const targetTable = targetType === 'event' ? 'event_files' : 'customer_files_new';
          const targetField = targetType === 'event' ? 'event_id' : 'customer_id';
          
          const { data: newFileRecord, error: newFileError } = await supabase
            .from(targetTable)
            .insert({
              filename: file.filename,
              file_path: newFilePath,
              content_type: file.content_type,
              size: file.size,
              user_id: userId,
              [targetField]: targetId,
              source: `${sourceType}_association`
            })
            .select()
            .single();
            
          if (newFileError) {
            console.error(`Error creating file record in ${targetTable}:`, newFileError);
          } else if (newFileRecord) {
            console.log(`Created new file record in ${targetTable} for ${file.filename}`);
            createdFileRecords.push(newFileRecord as FileRecord);
          }
        } catch (error) {
          console.error(`Error processing file ${file.filename}:`, error);
        }
      }
    } else {
      console.log(`No files found for ${sourceType} ${sourceId}`);
    }
    
    // Also check for direct file fields in the source entity (for booking requests)
    if (sourceType === 'booking') {
      const { data: sourceData, error: sourceError } = await supabase
        .from(sourceTable)
        .select('*')
        .eq('id', sourceId)
        .maybeSingle();
        
      if (sourceError) {
        console.error(`Error fetching ${sourceType} data:`, sourceError);
      } else if (sourceData && sourceData.file_path && sourceData.filename) {
        try {
          console.log(`Processing direct file from ${sourceTable}: ${sourceData.filename}`);
          
          // Download the file from the source bucket
          const sourceBucket = sourceType === 'booking' ? STORAGE_BUCKETS.BOOKING : STORAGE_BUCKETS.EVENT;
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(sourceBucket)
            .download(normalizeFilePath(sourceData.file_path));
            
          if (downloadError) {
            console.error(`Error downloading file from ${sourceBucket}:`, downloadError);
          } else if (fileData) {
            // Generate a new unique file path for the target entity
            const fileExtension = sourceData.filename.includes('.') ? 
              sourceData.filename.split('.').pop() || 'bin' : 'bin';
            
            const newFilePath = `${targetId}/${crypto.randomUUID()}.${fileExtension}`;
            
            // Upload to event_attachments
            const { error: uploadError } = await supabase.storage
              .from(STORAGE_BUCKETS.EVENT)
              .upload(newFilePath, fileData, { 
                contentType: sourceData.content_type || 'application/octet-stream' 
              });
              
            if (uploadError) {
              console.error(`Error uploading file to ${STORAGE_BUCKETS.EVENT}:`, uploadError);
            } else {
              console.log(`Successfully copied file to ${STORAGE_BUCKETS.EVENT}/${newFilePath}`);
              
              // Create record in the target files table
              const targetTable = targetType === 'event' ? 'event_files' : 'customer_files_new';
              const targetField = targetType === 'event' ? 'event_id' : 'customer_id';
              
              const { data: fileRecord, error: fileRecordError } = await supabase
                .from(targetTable)
                .insert({
                  filename: sourceData.filename,
                  file_path: newFilePath,
                  content_type: sourceData.content_type || 'application/octet-stream',
                  size: sourceData.size || 0,
                  user_id: userId,
                  [targetField]: targetId,
                  source: `${sourceType}_direct`
                })
                .select()
                .single();
                
              if (fileRecordError) {
                console.error(`Error creating file record in ${targetTable}:`, fileRecordError);
              } else if (fileRecord) {
                console.log(`Created file record in ${targetTable}:`, fileRecord);
                createdFileRecords.push(fileRecord as FileRecord);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing direct file from ${sourceType}:`, error);
        }
      }
    }
    
    return createdFileRecords;
  } catch (error) {
    console.error(`Error in associateFilesWithEntity:`, error);
    return [];
  }
};

// Helper function to invalidate all file-related query caches
export const invalidateFileQueries = (queryClient: any) => {
  queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
  queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
  queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
  queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
  queryClient.invalidateQueries({ queryKey: ['events'] });
  queryClient.invalidateQueries({ queryKey: ['customers'] });
  queryClient.invalidateQueries({ queryKey: ['notes'] });
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
};
