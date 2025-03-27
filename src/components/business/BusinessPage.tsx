
import { supabase } from '@/lib/supabase';
import { Business } from '@/lib/types';

// Fix for the publicUrl in BusinessPage.tsx
const getCoverImageUrl = (business?: Business) => {
  return business?.cover_photo 
    ? supabase.storage.from('business-images').getPublicUrl(business.cover_photo).data.publicUrl 
    : '/placeholder.svg';
};
