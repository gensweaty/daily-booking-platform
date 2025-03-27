
import { supabase } from '@/lib/supabase';
import { Business } from '@/lib/types';

// Fix for the publicUrl in BusinessPage.tsx
export const getCoverImageUrl = (business?: Business) => {
  if (!business?.cover_photo) return '/placeholder.svg';
  
  try {
    return supabase.storage.from('business-images').getPublicUrl(business.cover_photo).data.publicUrl;
  } catch (error) {
    console.error("Error getting cover image URL:", error);
    return '/placeholder.svg';
  }
};
