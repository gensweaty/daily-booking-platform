
import { supabase } from './supabase';
import { Note, Reminder, Task } from './types';

// Calendar events API functions
export async function getPublicCalendarEvents(businessId: string) {
  const response = await fetch(`/api/calendar/public?businessId=${businessId}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch public calendar events');
  }
  
  return await response.json();
}

// Task API functions
export async function getTasks(userId?: string) {
  const query = supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true });
    
  if (userId) {
    query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
    
  if (error) throw error;
  return data || [];
}

export async function createTask(taskData: Partial<Task>) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, taskData: Partial<Task>) {
  const { data, error } = await supabase
    .from('tasks')
    .update(taskData)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function deleteTask(id: string) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// Note API functions
export async function getNotes(userId?: string) {
  const query = supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (userId) {
    query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
    
  if (error) throw error;
  return data || [];
}

export async function createNote(noteData: Partial<Note>) {
  const { data, error } = await supabase
    .from('notes')
    .insert(noteData)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, noteData: Partial<Note>) {
  const { data, error } = await supabase
    .from('notes')
    .update(noteData)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function deleteNote(id: string) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// Reminder API functions
export async function getReminders(userId?: string) {
  const query = supabase
    .from('reminders')
    .select('*')
    .order('remind_at', { ascending: true });
    
  if (userId) {
    query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
    
  if (error) throw error;
  return data || [];
}

export async function createReminder(reminderData: Partial<Reminder>) {
  const { data, error } = await supabase
    .from('reminders')
    .insert(reminderData)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function updateReminder(id: string, reminderData: Partial<Reminder>) {
  const { data, error } = await supabase
    .from('reminders')
    .update(reminderData)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function deleteReminder(id: string) {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

// Booking request API functions
export async function createBookingRequest(requestData: any) {
  const { data, error } = await supabase
    .from('booking_requests')
    .insert(requestData)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

// You can also add other API functions here as needed:
// - For customers/CRM
// - For business profiles
// - For calendar events
// - etc.
