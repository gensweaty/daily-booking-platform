
import { supabase } from "@/lib/supabase";
import { getStorageUrl, normalizeFilePath } from "./client";
import { FileRecord } from "@/types/files";

/**
 * Copies a file from one Supabase storage bucket to another
 * 
 * @param sourceBucket The bucket to copy from
 * @param targetBucket The bucket to copy to
 * @param filePath The path of the file within the source bucket
 * @param targetPath Optional custom path for the destination file (defaults to source path)
 * @returns Promise resolving to an object with success status and file information
 */
export async function copyFileBetweenBuckets(
  sourceBucket: string,
  targetBucket: string,
  filePath: string,
  targetPath?: string
): Promise<{ 
  success: boolean;
  error?: string; 
  file?: FileRecord;
}> {
  try {
    console.log(`Copying file from ${sourceBucket}/${filePath} to ${targetBucket}/${targetPath || filePath}`);
    
    // Normalize the paths
    const normalizedSourcePath = normalizeFilePath(filePath);
    const normalizedTargetPath = normalizeFilePath(targetPath || filePath);
    
    // 1. Download the file from source bucket
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(sourceBucket)
      .download(normalizedSourcePath);
      
    if (downloadError) {
      console.error("Error downloading file:", downloadError);
      return { 
        success: false, 
        error: `Error downloading file: ${downloadError.message}` 
      };
    }
    
    if (!fileData) {
      return { 
        success: false, 
        error: 'File data is empty or undefined' 
      };
    }
    
    // 2. Upload the file to target bucket
    const filename = normalizedSourcePath.split('/').pop() || 'file';
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from(targetBucket)
      .upload(normalizedTargetPath, fileData, {
        contentType: fileData.type, // Preserve content type
        upsert: true // Overwrite if exists
      });
      
    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return { 
        success: false, 
        error: `Error uploading file: ${uploadError.message}` 
      };
    }
    
    // 3. Construct file record for the copied file
    const fileRecord: FileRecord = {
      id: crypto.randomUUID(), // Generate a new ID for the file record
      filename: filename,
      file_path: normalizedTargetPath,
      content_type: fileData.type,
      size: fileData.size || null,
      created_at: new Date().toISOString(),
      user_id: null, // This would typically be set when storing in DB
    };
    
    console.log("File copied successfully:", fileRecord);
    
    return {
      success: true,
      file: fileRecord
    };
    
  } catch (error) {
    console.error("Error in copyFileBetweenBuckets:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Copies multiple files between buckets
 * 
 * @param sourceBucket Source bucket name
 * @param targetBucket Target bucket name
 * @param filePaths Array of file paths to copy
 * @param targetPrefix Optional prefix to prepend to target paths
 * @returns Results for each file copy operation
 */
export async function copyFilesBetweenBuckets(
  sourceBucket: string,
  targetBucket: string,
  filePaths: string[],
  targetPrefix?: string
): Promise<{
  success: boolean;
  results: Array<{
    sourcePath: string;
    targetPath: string;
    success: boolean;
    error?: string;
  }>;
}> {
  const results = [];
  let allSucceeded = true;
  
  for (const path of filePaths) {
    const targetPath = targetPrefix 
      ? `${normalizeFilePath(targetPrefix)}/${path.split('/').pop()}`
      : path;
      
    const result = await copyFileBetweenBuckets(
      sourceBucket,
      targetBucket,
      path,
      targetPath
    );
    
    results.push({
      sourcePath: path,
      targetPath: targetPath,
      success: result.success,
      error: result.error
    });
    
    if (!result.success) allSucceeded = false;
  }
  
  return {
    success: allSucceeded,
    results
  };
}
