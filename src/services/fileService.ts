
import { supabase } from "@/integrations/supabase/client";
import { FileRecord } from "@/types/files";
import { QueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

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
    if (!file) {
      console.error('No file provided to uploadFile');
      return null;
    }

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
    let tableName = "";
    
    if (parentType === 'event') {
      tableName = "event_files";
    } else if (parentType === 'customer') {
      tableName = "customer_files_new";
    } else if (parentType === 'note') {
      tableName = "note_files";
    } else if (parentType === 'task') {
      tableName = "files";
    } else {
      tableName = "event_files"; // Default
    }
    
    console.log(`Deleting file record from table ${tableName}, id: ${fileId}`);
    
    // Delete from database with type safety
    const { error: dbError } = await supabase
      .from(tableName as any)
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
    let tableName = "";
    let parentIdField = '';
    
    if (parentType === 'event') {
      tableName = "event_files";
      parentIdField = 'event_id';
    } else if (parentType === 'customer') {
      tableName = "customer_files_new";
      parentIdField = 'customer_id';
    } else if (parentType === 'note') {
      tableName = "note_files";
      parentIdField = 'note_id';
    } else if (parentType === 'task') {
      tableName = "files";
      parentIdField = 'task_id';
    }
    
    const fileDataWithParentIds = fileData as any;
    
    const parentId = fileDataWithParentIds[parentType === 'event' ? 'event_id' : 
                            parentType === 'customer' ? 'customer_id' :
                            parentType === 'note' ? 'note_id' : 'task_id'];
    
    if (!parentId) {
      console.error(`Missing ${parentType}_id in file data`);
      return null;
    }
    
    // Create insertion data with the appropriate parent ID field
    const insertData: Record<string, any> = {
      filename: fileData.filename,
      file_path: fileData.file_path,
      content_type: fileData.content_type,
      size: fileData.size,
      user_id: fileData.user_id,
      [parentIdField]: parentId
    };
    
    // Validate required fields
    if (!insertData.filename || !insertData.file_path) {
      console.error('Missing required fields for file record creation');
      return null;
    }
    
    // Create the database record
    const { data, error } = await supabase
      .from(tableName as any)
      .insert(insertData)
      .select()
      .single();
      
    if (error) {
      console.error(`Error creating file record in ${tableName}:`, error);
      throw error;
    }
    
    if (!data) {
      throw new Error('No data returned from file record creation');
    }
    
    // Return data as FileRecord with type assertion
    return data as unknown as FileRecord;
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
    const sourceTable = sourceType === 'booking' ? 'booking_requests' : 
                      sourceType === 'event' ? 'events' : 'customers';
    
    // First, check if there are any files in the corresponding files table with the source ID
    const fileTable = sourceType === 'booking' || sourceType === 'event' ? 'event_files' :
                      sourceType === 'customer' ? 'customer_files_new' : null;
    
    if (!fileTable) {
      console.error(`Invalid source type: ${sourceType}`);
      return [];
    }
    
    // Get files from the source entity
    const { data: existingFiles, error: existingFilesError } = await supabase
      .from(fileTable as any)
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
          // Add null check before accessing file
          if (!file || typeof file !== 'object') {
            console.error('Invalid file record:', file);
            continue;
          }
          
          // Check for required properties using type guard
          if (!('file_path' in file) || !('filename' in file)) {
            console.error('File record is missing required properties:', file);
            continue;
          }
          
          // Now we can safely assert types since we've checked for existence
          const filePath = file.file_path as string;
          const filename = file.filename as string;
          
          if (!filePath || !filename) {
            console.error('File record has empty required properties:', file);
            continue;
          }

          // Get the actual file data from storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(STORAGE_BUCKETS.EVENT)
            .download(normalizeFilePath(filePath));

          if (downloadError) {
            console.error(`Error downloading existing file ${filename}:`, downloadError);
            continue;
          }

          if (!fileData) {
            console.error(`No file data returned for ${filePath}`);
            continue;
          }

          // Create a new file path for the target entity
          const fileExtension = filename.includes('.') ? 
            filename.split('.').pop() || 'bin' : 'bin';
          
          const newFilePath = `${targetId}/${crypto.randomUUID()}.${fileExtension}`;
          
          // Safely access content_type with fallback and proper type checking
          let contentType = 'application/octet-stream';
          
          if (file && typeof file === 'object' && 'content_type' in file && file.content_type !== null) {
            contentType = String(file.content_type);
          }
          
          // Upload to event_attachments with the new path
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKETS.EVENT)
            .upload(newFilePath, fileData, { contentType });
            
          if (uploadError) {
            console.error(`Error uploading file to ${STORAGE_BUCKETS.EVENT}:`, uploadError);
            continue;
          }

          // Create new record in the target files table
          const targetTable = targetType === 'event' ? 'event_files' : 'customer_files_new';
          const targetField = targetType === 'event' ? 'event_id' : 'customer_id';
          
          // Safely access size with fallback and proper type checking
          let size = 0;
          
          if (file && typeof file === 'object' && 'size' in file && file.size !== null) {
            size = Number(file.size) || 0;
          }
          
          // Create insertion data with required fields
          const insertData = {
            filename: filename,
            file_path: newFilePath,
            content_type: contentType,
            size: size,
            user_id: userId,
            [targetField]: targetId,
            source: `${sourceType}_association`
          };
          
          const { data: newFileRecord, error: newFileError } = await supabase
            .from(targetTable as any)
            .insert(insertData)
            .select()
            .single();
            
          if (newFileError) {
            console.error(`Error creating file record in ${targetTable}:`, newFileError);
          } else if (newFileRecord) {
            console.log(`Created new file record in ${targetTable} for ${filename}`);
            // Ensure the record is of proper type before pushing
            createdFileRecords.push(newFileRecord as unknown as FileRecord);
          }
        } catch (error) {
          console.error(`Error processing file:`, error);
        }
      }
    } else {
      console.log(`No files found for ${sourceType} ${sourceId}`);
    }
    
    // Also check for direct file fields in the source entity (for booking requests)
    if (sourceType === 'booking') {
      try {
        const { data: sourceData, error: sourceError } = await supabase
          .from(sourceTable as any)
          .select('*')
          .eq('id', sourceId)
          .maybeSingle();
          
        if (sourceError) {
          console.error(`Error fetching ${sourceType} data:`, sourceError);
        } else if (sourceData) {
          // Add strict null check and property existence check
          if (sourceData !== null && 
              typeof sourceData === 'object' && 
              'file_path' in sourceData && 
              'filename' in sourceData &&
              sourceData.file_path && 
              sourceData.filename) {
            
            try {
              // Access the file properties safely with explicit type casting
              const filePathValue = String(sourceData.file_path);
              const filenameValue = String(sourceData.filename);
              
              console.log(`Processing direct file from ${sourceTable}: ${filenameValue}`);
              
              // Download the file from the source bucket
              const sourceBucket = sourceType === 'booking' ? STORAGE_BUCKETS.BOOKING : STORAGE_BUCKETS.EVENT;
              
              const { data: fileData, error: downloadError } = await supabase.storage
                .from(sourceBucket)
                .download(normalizeFilePath(filePathValue));
                
              if (downloadError) {
                console.error(`Error downloading file from ${sourceBucket}:`, downloadError);
              } else if (fileData) {
                // Generate a new unique file path for the target entity
                const fileExtension = filenameValue.includes('.') ? 
                  filenameValue.split('.').pop() || 'bin' : 'bin';
                
                const newFilePath = `${targetId}/${crypto.randomUUID()}.${fileExtension}`;
                
                // Safely access content_type with fallback using proper null checks and type handling
                let contentType = 'application/octet-stream';
                
                if (sourceData !== null && 
                    typeof sourceData === 'object' && 
                    'content_type' in sourceData && 
                    sourceData.content_type !== null) {
                  contentType = String(sourceData.content_type);
                }
                
                // Upload to event_attachments
                const { error: uploadError } = await supabase.storage
                  .from(STORAGE_BUCKETS.EVENT)
                  .upload(newFilePath, fileData, { contentType });
                  
                if (uploadError) {
                  console.error(`Error uploading file to ${STORAGE_BUCKETS.EVENT}:`, uploadError);
                } else {
                  console.log(`Successfully copied file to ${STORAGE_BUCKETS.EVENT}/${newFilePath}`);
                  
                  // Create record in the target files table
                  const targetTable = targetType === 'event' ? 'event_files' : 'customer_files_new';
                  const targetField = targetType === 'event' ? 'event_id' : 'customer_id';
                  
                  // Safely access size with fallback using proper null checks and type handling
                  let size = 0;
                  
                  if (sourceData !== null && 
                      typeof sourceData === 'object' && 
                      'size' in sourceData && 
                      sourceData.size !== null) {
                    size = Number(sourceData.size) || 0;
                  }
                  
                  const insertData = {
                    filename: filenameValue,
                    file_path: newFilePath,
                    content_type: contentType,
                    size,
                    user_id: userId,
                    [targetField]: targetId,
                    source: `${sourceType}_direct`
                  };
                  
                  const { data: fileRecord, error: fileRecordError } = await supabase
                    .from(targetTable as any)
                    .insert(insertData)
                    .select()
                    .single();
                    
                  if (fileRecordError) {
                    console.error(`Error creating file record in ${targetTable}:`, fileRecordError);
                  } else if (fileRecord) {
                    console.log(`Created file record in ${targetTable}:`, fileRecord);
                    // Ensure type safety before adding to array
                    createdFileRecords.push(fileRecord as unknown as FileRecord);
                  }
                }
              }
            } catch (error) {
              console.error(`Error processing direct file from ${sourceType}:`, error);
            }
          } else {
            console.log(`No direct file fields found in ${sourceType} ${sourceId}`);
          }
        }
      } catch (error) {
        console.error(`Error in associateFilesWithEntity:`, error);
        return [];
      }
    }
    
    return createdFileRecords;
  } catch (error) {
    console.error(`Error in associateFilesWithEntity:`, error);
    return [];
  }
};

// Helper function to invalidate all file-related query caches
export const invalidateFileQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
  queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
  queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
  queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
  queryClient.invalidateQueries({ queryKey: ['events'] });
  queryClient.invalidateQueries({ queryKey: ['customers'] });
  queryClient.invalidateQueries({ queryKey: ['notes'] });
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
};

