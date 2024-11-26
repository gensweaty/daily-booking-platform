export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  created_at: string;
  user_id?: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  created_at: string;
  user_id?: string;
  order?: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id?: string;
  order?: number;
}