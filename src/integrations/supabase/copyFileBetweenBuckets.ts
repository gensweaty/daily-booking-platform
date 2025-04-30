
import { supabase } from "@/lib/supabase";
import { FileRecord } from "@/types/files";

/**
 * Copy a file from one Supabase storage bucket to another.
 * @param sourceBucket - The name of the source bucket (e.g., "booking_attachments")
 * @param destinationBucket - The name of the destination bucket (e.g., "event_attachments")
 * @param sourcePath - The path of the file in the source bucket
 * @param newFilename - Optional new filename (default keeps the original filename)
 * @returns The new path in the destination bucket, or throws error
 */
export async function copyFileBetweenBuckets({
  sourceBucket,
  destinationBucket,
  sourcePath,
  newFilename
}: {
  sourceBucket: string;
  destinationBucket: string;
  sourcePath: string;
  newFilename?: string;
}): Promise<string> {
  // Step 1: Download file from source bucket
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(sourceBucket)
    .download(sourcePath);

  if (downloadError || !fileBlob) {
    throw new Error(`Failed to download file from ${sourceBucket}: ${downloadError?.message}`);
  }

  // Step 2: Generate destination path
  const originalFilename = sourcePath.split("/").pop() || "file";
  const finalFilename = newFilename || `${Date.now()}_${originalFilename.replace(/\s+/g, "_")}`;

  // Step 3: Upload to destination bucket
  const { error: uploadError } = await supabase.storage
    .from(destinationBucket)
    .upload(finalFilename, fileBlob);

  if (uploadError) {
    throw new Error(`Failed to upload file to ${destinationBucket}: ${uploadError.message}`);
  }

  return finalFilename;
}

/**
 * Copies multiple files between buckets
 * 
 * @param sourceBucket Source bucket name
 * @param destinationBucket Target bucket name
 * @param filePaths Array of file paths to copy
 * @param targetPrefix Optional prefix to prepend to target paths
 * @returns Results for each file copy operation
 */
export async function copyFilesBetweenBuckets(
  sourceBucket: string,
  destinationBucket: string,
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
    try {
      // Generate new filename with optional prefix
      const originalFilename = path.split('/').pop() || 'file';
      const finalFilename = targetPrefix 
        ? `${targetPrefix}/${originalFilename}`
        : `${Date.now()}_${originalFilename.replace(/\s+/g, "_")}`;
      
      const newPath = await copyFileBetweenBuckets({
        sourceBucket,
        destinationBucket,
        sourcePath: path,
        newFilename: finalFilename
      });
      
      results.push({
        sourcePath: path,
        targetPath: newPath,
        success: true
      });
    } catch (error) {
      results.push({
        sourcePath: path,
        targetPath: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      
      allSucceeded = false;
    }
  }
  
  return {
    success: allSucceeded,
    results
  };
}
