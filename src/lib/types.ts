
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  created_at: string;
  user_id?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color?: string;
  created_at: string;
  user_id?: string;
}

export type { CalendarEventType as CalendarEvent } from './types/calendar';

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at: string;
  user_id?: string;
}

export interface Business {
  id: string;
  name: string;
  description?: string;
  contact_phone?: string;
  contact_address?: string;
  contact_email?: string;
  contact_website?: string;
  cover_photo_path?: string;
  slug: string;
  created_at: string;
  user_id: string;
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
}
