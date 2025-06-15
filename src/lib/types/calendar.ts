
export type CalendarViewType = 'month' | 'week' | 'day';

export interface GroupMember {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  paymentStatus: string;
  paymentAmount: string;
  notes: string;
}

export interface CalendarEventType {
  id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  start_date: string;
  end_date: string;
  type: 'birthday' | 'private_party' | 'booking_request' | 'group_event' | string;
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
  files?: Array<{
    id: string;
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
  // Group event fields
  is_group_event?: boolean;
  group_name?: string;
  group_members?: GroupMember[];
}
