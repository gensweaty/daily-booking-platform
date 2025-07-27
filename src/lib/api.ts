import { supabase } from './supabase';
import { Task } from './types';

export const createTask = async (task: Omit<Task, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      title: task.title,
      description: task.description,
      status: task.status,
      user_id: task.user_id,
      position: task.position,
      deadline_at: task.deadline_at,
      reminder_at: task.reminder_at,
      email_reminder_enabled: task.email_reminder_enabled || false
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }

  return data;
};

export const updateTask = async (id: string, updates: Partial<Task>) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      title: updates.title,
      description: updates.description,
      status: updates.status,
      position: updates.position,
      deadline_at: updates.deadline_at,
      reminder_at: updates.reminder_at,
      email_reminder_enabled: updates.email_reminder_enabled || false
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    throw error;
  }

  return data;
};

export const getTasks = async (userId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error getting tasks:', error);
    throw error;
  }

  return data;
};

export const deleteTask = async (id: string) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

export const archiveTask = async (id: string) => {
  const { error } = await supabase
    .from('tasks')
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error archiving task:', error);
    throw error;
  }
};
