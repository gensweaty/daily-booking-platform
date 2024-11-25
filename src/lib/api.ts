import { supabase } from './supabase';
import { Task, Reminder, Note } from './types';

// Tasks
export const getTasks = async () => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
  return data as Task[];
};

export const createTask = async (task: Omit<Task, 'id' | 'created_at' | 'user_id'>) => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error('Error getting user:', userError);
    throw userError;
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      ...task,
      user_id: userData.user?.id,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }
  return data;
};

// Reminders
export const getReminders = async () => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('due_date', { ascending: true });
  
  if (error) {
    console.error('Error fetching reminders:', error);
    throw error;
  }
  return data as Reminder[];
};

export const createReminder = async (reminder: Omit<Reminder, 'id' | 'created_at' | 'user_id'>) => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error('Error getting user:', userError);
    throw userError;
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert([{
      ...reminder,
      user_id: userData.user?.id,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating reminder:', error);
    throw error;
  }
  return data;
};

// Notes
export const getNotes = async () => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }
  return data as Note[];
};

export const createNote = async (note: Omit<Note, 'id' | 'created_at' | 'user_id'>) => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error('Error getting user:', userError);
    throw userError;
  }

  const { data, error } = await supabase
    .from('notes')
    .insert([{
      ...note,
      user_id: userData.user?.id,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating note:', error);
    throw error;
  }
  return data;
};