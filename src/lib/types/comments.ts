export interface TaskComment {
  id: string;
  task_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  created_by_name?: string;
  created_by_type?: string;
  last_edited_by_name?: string;
  last_edited_by_type?: string;
  last_edited_at?: string;
  deleted_at?: string;
}

export interface CommentFile {
  id: string;
  comment_id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  created_at: string;
  user_id?: string;
}