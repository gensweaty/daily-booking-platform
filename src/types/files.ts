
export interface FileRecord {
  id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  file_size?: number;
  created_at: string;
  user_id?: string;
  event_id?: string;
  customer_id?: string;
  note_id?: string;
  task_id?: string;
  booking_request_id?: string;
  source?: string;
}
