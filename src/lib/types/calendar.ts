
export type CalendarViewType = "month" | "week" | "day";

export interface CalendarEventType {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_at: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  type?: string;
  payment_status?: string;
  payment_amount?: number;
  user_id?: string;
  business_id?: string;
  updated_at?: string;
}
