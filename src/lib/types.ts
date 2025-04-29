export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'inprogress' | 'done';
  created_at: string;
  user_id?: string;
  position: number;
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
  remind_at: string;
  created_at: string;
  user_id: string;  // Making sure user_id is required, not optional
}

// Export BookingRequest from database.ts
export { type BookingRequest } from '../types/database';

// Payment status type for consistency across components 
// Includes both database and display formats
export type PaymentStatus = 
  'not_paid' | 'partly' | 'fully' | 
  'partly_paid' | 'fully_paid';
