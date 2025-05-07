
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
  // Add fields to make it more compatible with different file types
  note_id?: string | null;
  task_id?: string | null;
}
