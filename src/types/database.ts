export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'inprogress' | 'done';
  order: number;
  created_at: string;
  user_id: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  remind_at: string;
  created_at: string;
  user_id: string;
}

export interface Note {
  id: string;
  title: string;
  content?: string;
  category?: string;
  created_at: string;
  user_id: string;
}