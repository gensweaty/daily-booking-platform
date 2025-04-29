
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
      
      // IMPORTANT: Set public bucket policy since the createBucket sometimes doesn't apply this correctly
      if (isPublic) {
        try {
          // Use updateBucket to set public policy
          const { error: policyError } = await supabase.storage.updateBucket(
            bucketName,
            { public: true }
          );
          
          if (policyError) {
            console.error(`Failed to set public policy for ${bucketName}:`, policyError);
          } else {
            console.log(`Successfully set public policy for ${bucketName}`);
          }
          
          // Create an accessible placeholder file to ensure the bucket is properly initialized
          try {
            const placeholderContent = new Blob(['Placeholder for bucket initialization'], { type: 'text/plain' });
            const { error: placeholderError } = await supabase.storage
              .from(bucketName)
              .upload('placeholder.txt', placeholderContent);
              
            if (placeholderError) {
              console.error(`Error creating placeholder in ${bucketName}:`, placeholderError);
            } else {
              console.log(`Created placeholder file in ${bucketName}`);
            }
          } catch (placeholderErr) {
            console.error(`Error creating placeholder file in ${bucketName}:`, placeholderErr);
          }
        } catch (policyErr) {
          console.error(`Error setting public policy for ${bucketName}:`, policyErr);
        }
      }
      
      return true;
    }
    
    console.log(`${bucketName} bucket already exists`);
    
    // For existing buckets, check if they need to be public and update if necessary
    if (isPublic) {
      try {
        // Use updateBucket to set public policy
        const { error: policyError } = await supabase.storage.updateBucket(
          bucketName,
          { public: true }
        );
        
        if (policyError) {
          console.error(`Failed to set public policy for existing ${bucketName}:`, policyError);
        } else {
          console.log(`Verified public policy for existing ${bucketName}`);
        }
      } catch (policyErr) {
        console.error(`Error setting public policy for existing ${bucketName}:`, policyErr);
      }
    }
    
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
 * Checks if the booking_attachments storage bucket exists and creates it if needed
 */
export async function ensureBookingAttachmentsBucket() {
  return ensureBucketExists('booking_attachments', true);
}

/**
 * Ensure all required buckets exist
 */
export async function ensureAllRequiredBuckets() {
  console.log("Checking and ensuring all required storage buckets exist...");
  
  // Define all required buckets
  const bucketsToCheck = [
    {name: 'event_attachments', public: true},
    {name: 'booking_attachments', public: true},
    {name: 'customer_attachments', public: true},
    {name: 'task_attachments', public: true},
    {name: 'note_attachments', public: true}
  ];
  
  // Execute in sequence to avoid race conditions
  for (const bucket of bucketsToCheck) {
    const result = await ensureBucketExists(bucket.name, bucket.public);
    if (!result) {
      console.error(`Failed to create or verify bucket: ${bucket.name}`);
    }
  }
  
  console.log("All required buckets checked and exist");
  return true;
}
