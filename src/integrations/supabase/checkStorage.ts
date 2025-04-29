
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
        { public: true } // Make it public so files can be accessed without authentication
      );
      
      if (createError) {
        console.error('Failed to create event_attachments bucket:', createError);
        return false;
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
