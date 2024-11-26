export type CalendarViewType = 'month' | 'week' | 'day';

export interface CalendarEventType {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  location?: string;
  type: 'meeting' | 'reminder';
  created_at: string;
  user_id?: string;
}