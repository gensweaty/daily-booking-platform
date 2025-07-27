
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  position?: number;
  deadline_at?: string;
  reminder_at?: string;
  email_reminder?: boolean;
  reminder_sent?: boolean;
  archived?: boolean;
  archived_at?: string;
  deleted_at?: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  color?: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  reminder_date?: string;
  reminder_time?: string;
  is_completed?: boolean;
  created_at: string;
  updated_at: string;
  remind_at: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
