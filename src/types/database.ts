
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'inprogress' | 'done';
  order: number;
  created_at: string;
  user_id: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  remind_at: string;
  created_at: string;
  user_id: string;
}

export interface Note {
  id: string;
  title: string;
  content?: string;
  color?: string;
  category?: string;
  created_at: string;
  user_id: string;
}

export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  description?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  contact_website?: string;
  cover_photo_url?: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface BookingRequest {
  id: string;
  business_id: string;
  user_id: string; // Added this field to match our DB changes
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
}
