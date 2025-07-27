
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

export const getArchivedTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('archived', true)
    .order('archived_at', { ascending: false });

  if (error) {
    console.error("Error fetching archived tasks:", error);
    throw error;
  }

  return data || [];
};

export const restoreTask = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .update({ archived: false, archived_at: null })
    .eq('id', id);

  if (error) {
    console.error("Error restoring task:", error);
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

// Email functions
export const sendEventCreationEmail = async (
  to: string,
  customerName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  businessAddress: string,
  eventId: string,
  language: string = 'en',
  eventNotes: string = ''
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        to,
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

    return { success: true };
  } catch (error: any) {
    console.error('Error sending event creation email:', error);
    return { success: false, error: error.message };
  }
};

export const sendBookingConfirmationEmail = async (
  to: string,
  customerName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  businessAddress: string,
  eventId: string,
  language: string = 'en',
  eventNotes: string = ''
): Promise<{ success: boolean; error?: string }> => {
  return sendEventCreationEmail(
    to,
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
  );
};

export const sendBookingConfirmationToMultipleRecipients = async (
  recipients: Array<{
    email: string;
    name: string;
    paymentStatus: string;
    paymentAmount: number | null;
    eventNotes: string;
  }>,
  businessName: string,
  startDate: string,
  endDate: string,
  businessAddress: string,
  eventId: string,
  language: string = 'en'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const emailPromises = recipients.map(recipient =>
      sendEventCreationEmail(
        recipient.email,
        recipient.name,
        businessName,
        startDate,
        endDate,
        recipient.paymentStatus,
        recipient.paymentAmount,
        businessAddress,
        eventId,
        language,
        recipient.eventNotes
      )
    );

    const results = await Promise.all(emailPromises);
    const allSuccessful = results.every(result => result.success);

    if (allSuccessful) {
      return { success: true };
    } else {
      const errors = results.filter(result => !result.success).map(result => result.error).join(', ');
      return { success: false, error: errors };
    }
  } catch (error: any) {
    console.error('Error sending booking confirmation to multiple recipients:', error);
    return { success: false, error: error.message };
  }
};
