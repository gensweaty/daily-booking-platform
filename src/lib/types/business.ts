
export interface Business {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  contact_email: string | null;
  contact_website: string | null;
  cover_photo_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessFormData {
  name: string;
  description: string;
  contact_phone: string;
  contact_address: string;
  contact_email: string;
  contact_website: string;
  cover_photo?: File;
}

export interface EventRequest {
  id: string;
  business_id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  start_date: string;
  end_date: string;
  type?: string;
  payment_status?: string;
  payment_amount?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}
