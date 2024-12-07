export type CalendarViewType = 'month' | 'week' | 'day';

export interface CalendarEventType {
  id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  user_email?: string;
  event_notes?: string;
  start_date: string;
  end_date: string;
  type: 'meeting' | 'reminder';
  payment_status?: string;
  payment_amount?: number;
  created_at: string;
  user_id?: string;
}