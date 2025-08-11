import { supabase } from './supabase';
import { Task } from './types';

// Task operations
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
      email_reminder_enabled: task.email_reminder_enabled || false,
      created_by_name: task.created_by_name,
      created_by_type: task.created_by_type,
      last_edited_by_name: task.last_edited_by_name,
      last_edited_by_type: task.last_edited_by_type,
      last_edited_at: task.last_edited_at
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
      email_reminder_enabled: updates.email_reminder_enabled || false,
      last_edited_by_name: updates.last_edited_by_name,
      last_edited_by_type: updates.last_edited_by_type,
      last_edited_at: updates.last_edited_at
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
    .eq('archived', false)  // Only get non-archived tasks
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

// Archived tasks operations
export const getArchivedTasks = async (userId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('archived', true)
    .order('archived_at', { ascending: false });

  if (error) {
    console.error('Error getting archived tasks:', error);
    throw error;
  }

  return data || [];
};

export const restoreTask = async (id: string) => {
  const { error } = await supabase
    .from('tasks')
    .update({ archived: false, archived_at: null })
    .eq('id', id);

  if (error) {
    console.error('Error restoring task:', error);
    throw error;
  }
};

// Notes operations
export const getNotes = async (userId: string) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting notes:', error);
    throw error;
  }

  return data || [];
};

export const createNote = async (note: { title: string; content: string; user_id: string }) => {
  const { data, error } = await supabase
    .from('notes')
    .insert([note])
    .select()
    .single();

  if (error) {
    console.error('Error creating note:', error);
    throw error;
  }

  return data;
};

export const updateNote = async (id: string, updates: { title?: string; content?: string }) => {
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

export const deleteNote = async (id: string) => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

// Reminders operations
export const getReminders = async (userId: string) => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('reminder_at', { ascending: true });

  if (error) {
    console.error('Error getting reminders:', error);
    throw error;
  }

  return data || [];
};

export const createReminder = async (reminder: {
  title: string;
  description?: string;
  reminder_at: string;
  user_id: string;
}) => {
  const { data, error } = await supabase
    .from('reminders')
    .insert([reminder])
    .select()
    .single();

  if (error) {
    console.error('Error creating reminder:', error);
    throw error;
  }

  return data;
};

export const updateReminder = async (id: string, updates: {
  title?: string;
  description?: string;
  reminder_at?: string;
}) => {
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

export const deleteReminder = async (id: string) => {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting reminder:', error);
    throw error;
  }
};

// Email operations
export const sendEventCreationEmail = async (
  recipientEmail: string,
  recipientName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  contactAddress: string,
  eventId: string,
  language: string = 'en',
  eventNotes: string = ''
) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        recipientEmail,
        fullName: recipientName,
        businessName,
        startDate,
        endDate,
        paymentStatus,
        paymentAmount,
        businessAddress: contactAddress, // Changed from contactAddress to businessAddress
        eventId,
        language,
        eventNotes
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending event creation email:', error);
    throw error;
  }
};

export const sendBookingConfirmationEmail = async (
  recipientEmail: string,
  recipientName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  contactAddress: string,
  eventId: string,
  language: string = 'en',
  eventNotes: string = ''
) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        recipientEmail,
        fullName: recipientName,
        businessName,
        startDate,
        endDate,
        paymentStatus,
        paymentAmount,
        businessAddress: contactAddress, // Changed from contactAddress to businessAddress
        eventId,
        language,
        eventNotes
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
    throw error;
  }
};

export const sendBookingConfirmationToMultipleRecipients = async (
  recipients: Array<{ email: string; name: string }>,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  contactAddress: string,
  eventId: string,
  language: string = 'en',
  eventNotes: string = ''
) => {
  const results = {
    successful: 0,
    failed: 0,
    total: recipients.length
  };

  for (const recipient of recipients) {
    try {
      await sendBookingConfirmationEmail(
        recipient.email,
        recipient.name,
        businessName,
        startDate,
        endDate,
        paymentStatus,
        paymentAmount,
        contactAddress,
        eventId,
        language,
        eventNotes
      );
      results.successful++;
    } catch (error) {
      console.error(`Failed to send email to ${recipient.email}:`, error);
      results.failed++;
    }
  }

  return results;
};

// Task email reminder
export const sendTaskReminderEmail = async (taskId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-task-reminder-email', {
      body: { taskId }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending task reminder email:', error);
    throw error;
  }
};
