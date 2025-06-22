
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
  type: 'birthday' | 'private_party' | 'booking_request' | string;
  payment_status?: string;
  payment_amount?: number;
  created_at: string;
  user_id: string;
  requester_name?: string;
  requester_email?: string;
  requester_phone?: string;
  description?: string;
  file?: File;
  deleted_at?: string; 
  file_path?: string;
  filename?: string;
  content_type?: string;
  size?: number;
  checkAvailability?: boolean;
  language?: string;
  customer_id?: string;
  event_name?: string;
  // Recurring event fields
  repeat_pattern?: string;
  repeat_until?: string;
  is_recurring?: boolean;
  parent_event_id?: string;
  recurrence_instance_date?: string;
  // For frontend-generated recurring instances
  isRecurringInstance?: boolean;
  parentEventId?: string;
  instanceDate?: string;
  files?: Array<{
    id: string;
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
}
