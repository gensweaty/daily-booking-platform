import { supabase } from "./supabase";
import { Task, Reminder, Note } from "./types";

export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }

  return data || [];
};

export const createTask = async (task: Omit<Task, 'id' | 'created_at'>): Promise<Task> => {
  console.log('Creating task with data:', task);
  
  const { data, error } = await supabase
    .from('tasks')
    .insert([task])
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }

  console.log('Task created successfully:', data);
  return data;
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<Task> => {
  console.log('Updating task with id:', id, 'updates:', updates);
  
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    throw error;
  }

  console.log('Task updated successfully:', data);
  return data;
};

export const deleteTask = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting task:", error);
    throw error;
  }
};

export const archiveTask = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error("Error archiving task:", error);
    throw error;
  }
};

export const getReminders = async (): Promise<Reminder[]> => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*');

  if (error) {
    console.error("Error fetching reminders:", error);
    throw error;
  }

  return data || [];
};

export const createReminder = async (reminder: Omit<Reminder, 'id' | 'created_at'>): Promise<Reminder> => {
  const { data, error } = await supabase
    .from('reminders')
    .insert([reminder])
    .select()
    .single();

  if (error) {
    console.error("Error creating reminder:", error);
    throw error;
  }

  return data;
};

export const updateReminder = async (id: string, updates: Partial<Reminder>): Promise<Reminder> => {
  const { data, error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating reminder:", error);
    throw error;
  }

  return data;
};

export const deleteReminder = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting reminder:", error);
    throw error;
  }
};

export const getNotes = async (): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*');

  if (error) {
    console.error("Error fetching notes:", error);
    throw error;
  }

  return data || [];
};

export const createNote = async (note: Omit<Note, 'id' | 'created_at'>): Promise<Note> => {
  const { data, error } = await supabase
    .from('notes')
    .insert([note])
    .select()
    .single();

  if (error) {
    console.error("Error creating note:", error);
    throw error;
  }

  return data;
};

export const updateNote = async (id: string, updates: Partial<Note>): Promise<Note> => {
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating note:", error);
    throw error;
  }

  return data;
};

export const deleteNote = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting note:", error);
    throw error;
  }
};
