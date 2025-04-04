
export type CalendarViewType = 'month' | 'week' | 'day';

export interface CalendarEventType {
  id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  start_date: string;
  end_date: string;
  type: 'birthday' | 'private_party';
  payment_status?: string;
  payment_amount?: number;
  created_at: string;
  user_id?: string;
}
