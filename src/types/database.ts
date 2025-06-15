
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
  deleted_at?: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  payment_status?: string;
  payment_amount?: number | null;
  language?: string; // Add language field to BookingRequest interface
  // File fields explicitly defined
  file_path?: string;
  filename?: string;
  content_type?: string;
  size?: number;
  // Add the files property for multiple file attachments
  files?: Array<{
    id: string;
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
}

// Add EventFile interface to match event_files table
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

// Add CustomerFile interface to match customer_files_new table
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

// Update Customer interface to include group booking fields
export interface Customer {
  id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  user_id?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  event_notes?: string;
  social_network_link?: string;
  payment_amount?: number;
  payment_status?: string;
  created_at: string;
  deleted_at?: string;
  create_event?: boolean;
  // New group booking fields
  parent_group_id?: string;
  is_group_member?: boolean;
}
