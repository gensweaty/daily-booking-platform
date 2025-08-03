export type CalendarViewType = "day" | "week" | "month";

export interface TaskType {
  id: string;
  title: string;
  description: string;
  status: "todo" | "inprogress" | "done";
  createdAt: string;
  updatedAt: string;
  user_id?: string;
  deadline?: string | null;
  reminder?: string | null;
  email_reminder_enabled?: boolean;
  archived?: boolean;
  files?: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
}

export interface NoteType {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user_id?: string;
}

export interface ContactType {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  user_id?: string;
}

export interface CalendarEventType {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  user_id?: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  event_name?: string;
  payment_status?: string;
  payment_amount?: number;
  type?: string;
  is_recurring?: boolean;
  repeat_pattern?: string;
  repeat_until?: string;
  parent_event_id?: string;
  language?: string;
  reminder_at?: string;
  email_reminder_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  additionalPersons?: any[];
}

export interface OptimizedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  user_surname?: string;
  payment_status?: string;
  payment_amount?: number;
  type?: string;
  reminder_at?: string;
}
