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

export interface Customer {
  id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  payment_status?: string;
  payment_amount?: number;
  user_id?: string;
  type?: string;
  created_at?: string;
  start_date?: string;
  end_date?: string;
}
