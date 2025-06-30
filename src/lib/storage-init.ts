
import { supabase } from './supabase';

export const initializeStorage = async () => {
  try {
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === 'event_attachments');
    
    if (!bucketExists) {
      console.log('Creating event_attachments storage bucket...');
      const { error } = await supabase.storage.createBucket('event_attachments', {
        public: true,
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (error) {
        console.error('Failed to create storage bucket:', error);
      } else {
        console.log('Storage bucket created successfully');
      }
    }
  } catch (error) {
    console.error('Storage initialization error:', error);
  }
};
