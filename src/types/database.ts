
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
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  // Additional fields to match EventDialog
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  payment_status?: string;
  payment_amount?: number | null;
  // File metadata fields - explicitly defined
  file_path?: string;
  filename?: string;
  content_type?: string;
  file_size?: number;
  size?: number;
  deleted_at?: string;
}

export interface BookingFile {
  id: string;
  booking_request_id: string;
  filename: string;
  file_path: string;
  content_type?: string | null;
  size?: number | null;
  created_at: string;
  user_id?: string | null;
}
