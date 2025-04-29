
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
  event_files?: any[]; // Store associated event files
  booking_request_id?: string;
  // File metadata properties - ensure these match what's in the database
  file_path?: string;
  filename?: string;
  content_type?: string;
  file_size?: number;
  size?: number;
}
