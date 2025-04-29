
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
  user_id: string | null; // Make user_id nullable for public booking requests
  requester_name: string;
  requester_email: string;
  requester_phone?: string;
  title: string;
  description?: string;
  start_date: string; // ISO format date string
  end_date: string;   // ISO format date string
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  created_at: string;
  updated_at: string;
  deleted_at?: string; // Added this field for soft deletion
  // Additional fields to match EventDialog
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  payment_status?: 'not_paid' | 'partly_paid' | 'fully_paid' | 'partly' | 'fully';
  payment_amount?: number | null;
  files?: any[]; // Added to track associated files
}
