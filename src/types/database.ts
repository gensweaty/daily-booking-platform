
export interface BookingRequest {
  id: string;
  business_id: string;
  requester_name: string;
  requester_email: string;
  requester_phone?: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  user_id?: string | null;
  payment_amount?: number | null;
  payment_status?: string;
  deleted_at?: string | null;
}

export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  slug: string;
  description?: string;
  cover_photo_url?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  contact_website?: string;
  created_at: string;
  updated_at: string;
}
