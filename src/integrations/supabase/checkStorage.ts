
import { supabase } from './client';

// List of all storage buckets used in the application
export const REQUIRED_BUCKETS = [
  'event_attachments',
  'customer_attachments',
  'note_attachments',
  'task_attachments',
  'booking_attachments'  // Added booking_attachments to the required buckets
];

// Check if a bucket exists, if not create it
const checkOrCreateBucket = async (bucketName: string): Promise<boolean> => {
  try {
    console.log(`Checking if bucket ${bucketName} exists...`);
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error(`Error checking bucket ${bucketName}:`, error);
      return false;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`Bucket ${bucketName} not found, creating...`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true // Make the bucket publicly accessible
      });
      
      if (createError) {
        console.error(`Error creating bucket ${bucketName}:`, createError);
        return false;
      }
      
      console.log(`Bucket ${bucketName} created successfully`);
      
      // Create a default public policy for the bucket
      try {
        // Use the generic function call to avoid TypeScript type errors
        const { error: policyError } = await supabase.functions.invoke('create-storage-policy', {
          body: { bucketName }
        });
        
        if (policyError) {
          console.warn(`Warning: Failed to set public policy for bucket ${bucketName}:`, policyError);
          // Continue even if policy creation fails, as we can still use the bucket
        }
      } catch (rpcError) {
        console.warn(`RPC error for bucket ${bucketName}:`, rpcError);
        // Continue despite RPC error - the bucket still exists and is usable
      }
    } else {
      console.log(`Bucket ${bucketName} already exists`);
    }
    
    return true;
  } catch (err) {
    console.error(`Error checking/creating bucket ${bucketName}:`, err);
    return false;
  }
};

// Ensure all required buckets exist
export const ensureAllRequiredBuckets = async (): Promise<boolean> => {
  try {
    let allSuccess = true;
    
    for (const bucket of REQUIRED_BUCKETS) {
      const success = await checkOrCreateBucket(bucket);
      if (!success) {
        allSuccess = false;
      }
    }
    
    return allSuccess;
  } catch (error) {
    console.error("Error ensuring all required buckets exist:", error);
    return false;
  }
};

// Helper function to ensure just the event_attachments bucket exists
export const ensureEventAttachmentsBucket = async (): Promise<boolean> => {
  return await checkOrCreateBucket('event_attachments');
};

// Helper function to ensure just the booking_attachments bucket exists
export const ensureBookingAttachmentsBucket = async (): Promise<boolean> => {
  return await checkOrCreateBucket('booking_attachments');
};

// Helper functions for other specific buckets
export const ensureCustomerAttachmentsBucket = async (): Promise<boolean> => {
  return await checkOrCreateBucket('customer_attachments');
};

export const ensureNoteAttachmentsBucket = async (): Promise<boolean> => {
  return await checkOrCreateBucket('note_attachments');
};

export const ensureTaskAttachmentsBucket = async (): Promise<boolean> => {
  return await checkOrCreateBucket('task_attachments');
};
