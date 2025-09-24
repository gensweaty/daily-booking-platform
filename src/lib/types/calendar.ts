
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
  updated_at: string; // Now properly typed as required field
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
  booking_request_id?: string;
  // Recurring event properties
  is_recurring?: boolean;
  repeat_pattern?: string;
  repeat_until?: string;
  parent_event_id?: string;
  excluded_from_series?: boolean;
  // Email reminder properties
  reminder_at?: string;
  email_reminder_enabled?: boolean;
  reminder_sent_at?: string;
  // Sub-user tracking properties
  created_by_type?: string;
  created_by_name?: string;
  last_edited_by_type?: string;
  last_edited_by_name?: string;
  files?: Array<{
    id: string;
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
}
