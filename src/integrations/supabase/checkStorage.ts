
import { supabase } from './client';

/**
 * Checks if the event_attachments storage bucket exists and creates it if needed
 */
export async function ensureEventAttachmentsBucket() {
  try {
    // Check if the bucket exists
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Failed to list storage buckets:', error);
      return false;
    }
    
    const eventAttachmentsBucket = buckets.find(bucket => bucket.name === 'event_attachments');
    
    if (!eventAttachmentsBucket) {
      console.log('Event attachments bucket not found, creating it...');
      
      // Try to create the bucket
      const { data, error: createError } = await supabase.storage.createBucket(
        'event_attachments',
        { 
          public: true, // Make it public so files can be accessed without authentication
          fileSizeLimit: 50 * 1024 * 1024 // 50MB file size limit
        }
      );
      
      if (createError) {
        console.error('Failed to create event_attachments bucket:', createError);
        return false;
      }
      
      // Create public policy for the bucket to allow reading files
      try {
        await supabase.rpc('create_storage_policy', {
          bucket_name: 'event_attachments',
          policy_name: 'Public Access Policy',
          definition: 'true', // Allow public access
          operation: 'SELECT' // For read operations
        });
        
        console.log('Created public access policy for event_attachments bucket');
      } catch (policyError) {
        console.warn('Could not create bucket policy (might already exist):', policyError);
      }
      
      console.log('Successfully created event_attachments bucket');
      return true;
    }
    
    console.log('Event attachments bucket already exists');
    return true;
  } catch (error) {
    console.error('Error checking/creating storage bucket:', error);
    return false;
  }
}

/**
 * Ensure all required buckets exist
 */
export async function ensureAllRequiredBuckets() {
  const bucketsToCheck = [
    {name: 'event_attachments', public: true},
    {name: 'customer_attachments', public: true},
    {name: 'task_attachments', public: true},
    {name: 'note_attachments', public: true}
  ];
  
  try {
    const { data: existingBuckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Failed to list storage buckets:', error);
      return false;
    }
    
    for (const bucketConfig of bucketsToCheck) {
      const bucketExists = existingBuckets.some(bucket => bucket.name === bucketConfig.name);
      
      if (!bucketExists) {
        console.log(`${bucketConfig.name} bucket not found, creating it...`);
        
        try {
          const { error: createError } = await supabase.storage.createBucket(
            bucketConfig.name,
            { 
              public: bucketConfig.public,
              fileSizeLimit: 50 * 1024 * 1024 // 50MB file size limit
            }
          );
          
          if (createError) {
            console.error(`Failed to create ${bucketConfig.name} bucket:`, createError);
            continue;
          }
          
          // Create public policy for public buckets
          if (bucketConfig.public) {
            try {
              await supabase.rpc('create_storage_policy', {
                bucket_name: bucketConfig.name,
                policy_name: 'Public Access Policy',
                definition: 'true', // Allow public access
                operation: 'SELECT' // For read operations
              });
              
              console.log(`Created public access policy for ${bucketConfig.name} bucket`);
            } catch (policyError) {
              console.warn(`Could not create bucket policy for ${bucketConfig.name} (might already exist):`, policyError);
            }
          }
          
          console.log(`Successfully created ${bucketConfig.name} bucket`);
        } catch (bucketError) {
          console.error(`Error creating ${bucketConfig.name} bucket:`, bucketError);
        }
      } else {
        console.log(`${bucketConfig.name} bucket already exists`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring required buckets exist:', error);
    return false;
  }
}
