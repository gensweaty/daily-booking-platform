
export type CalendarViewType = 'month' | 'week' | 'day';

// Updated to match the database.ts version, making event_notes required
export interface CalendarEventType {
  id: string;
  title: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes: string;  // Changed from optional to required to match database.ts
  start_date: string;
  end_date: string;
  type?: string;  // String type to match database.ts
  payment_status?: string;
  payment_amount?: number;
  created_at: string;
  user_id?: string;
  business_id?: string;
  booking_request_id?: string;
  deleted_at?: string | null;
}
