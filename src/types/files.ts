
export interface FileRecord {
  id: string;
  filename: string;
  file_path: string;
  content_type: string | null;
  size: number | null;
  created_at: string;
  user_id: string | null;
  event_id?: string | null;
  customer_id?: string | null;
  source?: string;
}
