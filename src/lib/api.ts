
import { supabase } from "./supabase";
import { CalendarEventType } from "./types/calendar";
import { Task, Note, Reminder } from "./types";

export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    // First get the user_id for this business
    const { data: businessData, error: businessError } = await supabase
      .from("business_profiles")
      .select("user_id")
      .eq("id", businessId)
      .single();
    
    if (businessError) {
      console.error("Error fetching business user ID:", businessError);
      throw businessError;
    }
    
    if (!businessData?.user_id) {
      console.error("No user ID found for business:", businessId);
      throw new Error("Business not found");
    }
    
    console.log(`[API] Getting calendar events for user ${businessData.user_id}`);
    
    // Get all events for this user, explicitly excluding deleted events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', businessData.user_id)
      .is('deleted_at', null) // IMPORTANT: Only get non-deleted events
      .order('start_date', { ascending: true });
    
    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw eventsError;
    }
    
    console.log(`[API] Found ${events?.length || 0} calendar events`);
    
    // Get approved booking requests for this business
    const { data: bookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .order('start_date', { ascending: true });
    
    if (bookingsError) {
      console.error("Error fetching approved bookings:", bookingsError);
      throw bookingsError;
    }
    
    console.log(`[API] Found ${bookings?.length || 0} approved booking requests`);
    
    return { events, bookings };
  } catch (error) {
    console.error("Error in getPublicCalendarEvents:", error);
    return { events: [], bookings: [] };
  }
};

// Tasks API
export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true });
  
  if (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
  
  return data || [];
};

export const createTask = async (taskData: Partial<Task>): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([taskData])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }
  
  return data;
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<Task> => {
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
  
  return data;
};

export const deleteTask = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

// Notes API
export const getNotes = async (): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }
  
  return data || [];
};

export const updateNote = async (id: string, updates: Partial<Note>): Promise<Note> => {
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating note:', error);
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
    console.error('Error deleting note:', error);
    throw error;
  }
};

// Reminders API
export const getReminders = async (): Promise<Reminder[]> => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('remind_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching reminders:', error);
    throw error;
  }
  
  return data || [];
};

export const createReminder = async (reminderData: Partial<Reminder>): Promise<Reminder> => {
  const { data, error } = await supabase
    .from('reminders')
    .insert([reminderData])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating reminder:', error);
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
    console.error('Error updating reminder:', error);
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
    console.error('Error deleting reminder:', error);
    throw error;
  }
};
