
export interface FileRecord {
  id: string;
  filename: string;
  file_path: string;
  content_type: string | null;
  size: number | null;
  created_at: string;
  user_id: string | null;
  event_id?: string | null;
  customer_id?: string | null; // Properly typed as optional string
  source?: string;
  parentType?: string; // Add parentType field for better source tracking
  // Additional fields for compatibility
  note_id?: string | null;
  task_id?: string | null;
}
