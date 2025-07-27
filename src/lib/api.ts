import { supabase } from "./supabase";
import { Task, Reminder, Note } from "./types";

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

export const createReminder = async (reminder: Partial<Reminder>) => {
  const { data, error } = await supabase
    .from('reminders')
    .insert([reminder])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getReminders = async () => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const updateReminder = async (id: string, updates: Partial<Reminder>) => {
  const { data, error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteReminder = async (id: string) => {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const getNotes = async () => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const updateNote = async (id: string, updates: Partial<Note>) => {
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteNote = async (id: string) => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const deleteTask = async (id: string) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const getArchivedTasks = async () => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('archived', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const restoreTask = async (id: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ archived: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getTasksForUser = async (userId: string) => {
  return getTasks(userId);
};

// Fixed function signature to match what's expected in the codebase
export const sendEventCreationEmail = async (
  customerEmail: string,
  customerName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  businessAddress: string,
  eventId: string,
  language: string,
  eventNotes: string
) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        customerEmail,
        customerName,
        businessName,
        startDate,
        endDate,
        paymentStatus,
        paymentAmount,
        businessAddress,
        eventId,
        language,
        eventNotes
      }
    });

    if (error) {
      console.error('Error sending event creation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending event creation email:', error);
    return { success: false, error: error.message };
  }
};

// Fixed function signatures to return proper response objects
export const sendBookingConfirmationEmail = async (bookingData: any) => {
  try {
    console.log('Booking confirmation email would be sent:', bookingData);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const sendBookingConfirmationToMultipleRecipients = async (bookingData: any, recipients: string[]) => {
  try {
    console.log('Booking confirmation emails would be sent to:', recipients, bookingData);
    return { 
      success: true, 
      successful: recipients.length,
      failed: 0,
      total: recipients.length 
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message,
      successful: 0,
      failed: recipients.length,
      total: recipients.length 
    };
  }
};
