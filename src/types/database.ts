
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
  user_id: string | null;
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
  deleted_at?: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  payment_status?: string;
  payment_amount?: number | null;
  language?: string;
  file_path?: string;
  filename?: string;
  content_type?: string;
  size?: number;
  files?: Array<{
    id: string;
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
}

export interface EventFile {
  id: string;
  event_id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  user_id?: string;
  created_at: string;
  source?: string;
}

export interface CustomerFile {
  id: string;
  customer_id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  user_id?: string;
  created_at: string;
  source?: string;
}

// Add group member interface for type safety
export interface GroupMember {
  id?: string;
  full_name: string;
  email: string;
  phone?: string;
  payment_status?: string;
  notes?: string;
}
