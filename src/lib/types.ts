export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  emailVerified?: Date | null;
}

export interface Account {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}

export interface Session {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
}

export interface VerificationToken {
  identifier: string;
  token: string;
  expires: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'inprogress' | 'done';
  created_at: string;
  updated_at: string;
  user_id: string;
  due_date?: string;
  reminder_time?: string;
  priority?: 'low' | 'medium' | 'high';
  archived?: boolean;
  send_email_reminder?: boolean;
  reminder_sent?: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  color?: string;
  category?: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  remind_at: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  completed?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  payment_status?: PaymentStatus;
  payment_amount?: number;
  social_network_link?: string;
  user_surname?: string;
  user_number?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  all_day?: boolean;
  location?: string;
  event_type?: string;
  attendees?: string[];
  created_at: string;
  updated_at: string;
  user_id: string;
  recurring_pattern?: string;
  recurring_end_date?: string;
  parent_event_id?: string;
  language?: string;
  notes?: string;
  payment_status?: PaymentStatus;
  payment_amount?: number;
  social_network_link?: string;
  user_surname?: string;
  user_number?: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
