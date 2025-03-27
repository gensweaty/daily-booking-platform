
export interface Business {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  contact_phone?: string;
  contact_address?: string;
  contact_email?: string;
  contact_website?: string;
  cover_photo_path?: string;
  slug: string;
  created_at: string;
  updated_at: string;
}
