
export interface Note {
  id: string;
  created_at: string;
  title: string;
  content: string;
  user_id: string;
  color?: string; // Added color property
}

export interface CalendarEventType {
  id: string;
  title: string;
  event_notes: string;
  start_date: string;
  end_date: string;
  user_id?: string;
  business_id?: string;
  booking_request_id?: string;
  type?: string;
  created_at?: string;
  user_surname?: string;
  user_number?: string;
  payment_status?: string;
  payment_amount?: number;
  social_network_link?: string;
  deleted_at?: string | null;
}

export interface Task {
  id: string;
  created_at: string;
  title: string;
  status: 'todo' | 'inprogress' | 'done'; // Changed from is_completed to status
  user_id: string;
  description?: string; // Added description
  order?: number; // Added order property
}

export interface Reminder {
  id: string;
  created_at: string;
  title: string;
  time: string;
  user_id: string;
  description?: string; // Added description property
  remind_at?: string; // Added remind_at property
}

export interface BusinessProfile {
  id: string;
  created_at: string;
  updated_at: string;
  business_name: string;
  business_description: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  business_website: string;
  business_logo: string;
  user_id: string;
  slug: string;
  // New fields added to match component usage
  description?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  contact_website?: string;
  cover_photo_url?: string;
}

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
  status: "pending" | "approved" | "rejected";
  created_at?: string;
  updated_at?: string;
}
