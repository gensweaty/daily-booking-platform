
import { supabase } from './client';

/**
 * Checks if a storage bucket exists and creates it if needed with public access
 */
export async function ensureBucketExists(bucketName: string, isPublic: boolean = true) {
  try {
    console.log(`Checking if ${bucketName} bucket exists...`);
    
    // Check if the bucket exists
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error(`Failed to list storage buckets:`, error);
      return false;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`${bucketName} bucket not found, creating it...`);
      
      // Try to create the bucket
      const { data, error: createError } = await supabase.storage
        .createBucket(
          bucketName,
          { 
            public: isPublic,
            fileSizeLimit: 50 * 1024 * 1024 // 50MB file size limit
          }
        );
      
      if (createError) {
        console.error(`Failed to create ${bucketName} bucket:`, createError);
        return false;
      }
      
      console.log(`Successfully created ${bucketName} bucket with public access:`, isPublic);
      return true;
    }
    
    console.log(`${bucketName} bucket already exists`);
    return true;
  } catch (error) {
    console.error(`Error checking/creating storage bucket ${bucketName}:`, error);
    return false;
  }
}

/**
 * Checks if the event_attachments storage bucket exists and creates it if needed
 */
export async function ensureEventAttachmentsBucket() {
  return ensureBucketExists('event_attachments', true);
}

/**
 * Ensure all required buckets exist
 */
export async function ensureAllRequiredBuckets() {
  console.log("Checking and ensuring all required storage buckets exist...");
  
  const bucketsToCheck = [
    {name: 'event_attachments', public: true},
    {name: 'customer_attachments', public: true},
    {name: 'task_attachments', public: true},
    {name: 'note_attachments', public: true}
  ];
  
  const results = await Promise.all(
    bucketsToCheck.map(bucket => ensureBucketExists(bucket.name, bucket.public))
  );
  
  const allSucceeded = results.every(result => result === true);
  
  if (allSucceeded) {
    console.log("All required buckets checked and exist");
  } else {
    console.error("Failed to create or verify one or more required buckets");
  }
  
  return allSucceeded;
}
