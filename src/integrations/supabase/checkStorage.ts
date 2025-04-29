
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
      const { data, error: createError } = await supabase.storage
        .createBucket(
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
      
      console.log('Successfully created event_attachments bucket with public access');
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
          const { error: createError } = await supabase.storage
            .createBucket(
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
          
          if (bucketConfig.public) {
            console.log(`Created ${bucketConfig.name} bucket with public access`);
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
