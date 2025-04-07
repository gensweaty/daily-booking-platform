
export type CalendarViewType = "day" | "week" | "month";

export interface CalendarEventType {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_at: string;
  user_id: string;
  type?: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  payment_status?: string;
  payment_amount?: number;
  requester_name?: string;
  requester_email?: string;
  requester_phone?: string;
  description?: string;
  file_path?: string;
  filename?: string;
}

export interface TimeSlot {
  date: Date;
  startTime: string;
  endTime: string;
  label: string;
}
