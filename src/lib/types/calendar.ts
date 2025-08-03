
export type CalendarViewType = "month" | "week" | "day";

export interface CalendarEventType {
  id: string;
  title: string;
  user_surname: string;
  user_number?: string;
  social_network_link?: string; // This is the email field
  event_notes?: string;
  start_date: string;
  end_date: string;
  user_id: string;
  payment_status?: string;
  payment_amount?: number | null;
  language?: string;
  type?: string;
  created_at?: string;
  deleted_at?: string;
  // Recurring event fields
  recurring_parent_id?: string;
  recurring_pattern?: string;
  recurring_until?: string;
  parent_event_id?: string;
  // Additional recurring fields for compatibility
  is_recurring?: boolean;
  repeat_pattern?: string;
  repeat_until?: string;
  // Additional persons data
  additional_persons?: Array<{
    id: string;
    userSurname: string;
    userNumber: string;
    socialNetworkLink: string;
    eventNotes: string;
    paymentStatus: string;
    paymentAmount: string;
  }>;
  // File attachments
  files?: Array<{
    id: string;
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
  // Reminder fields - updated structure
  reminder_at?: string;
  reminder_enabled?: boolean;
  reminder_sent_at?: string;
  email_reminder_enabled?: boolean;
  // Additional compatibility fields
  event_name?: string;
  requester_name?: string;
}
