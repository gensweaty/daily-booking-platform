import { supabase } from "./supabase";
import { Task } from "./types";

export const getTasks = async (userId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }
  return data || [];
};

export const getTask = async (taskId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) throw error;
  return data;
};

export const archiveTask = async (taskId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTask = async (task: {
  title: string;
  description?: string;
  status: 'todo' | 'inprogress' | 'done';
  user_id: string;
  position?: number;
  deadline_at?: string | null;
  reminder_at?: string | null;
  email_reminder?: boolean;
  reminder_sent?: boolean;
}) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([task])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTask = async (id: string, updates: {
  title?: string;
  description?: string;
  status?: 'todo' | 'inprogress' | 'done';
  position?: number;
  deadline_at?: string | null;
  reminder_at?: string | null;
  email_reminder?: boolean;
  reminder_sent?: boolean;
}) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
