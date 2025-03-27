
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
  slug?: string;
  contact_phone?: string;
  contact_address?: string;
  contact_email?: string;
  contact_website?: string;
  cover_photo?: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessData extends Omit<Business, 'id' | 'created_at' | 'updated_at'> {}
