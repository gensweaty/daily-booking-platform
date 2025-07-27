
import { supabase } from "./supabase";
import { Task, Note, Reminder } from "./types";

export const sendBookingApprovalEmail = async (
  email: string,
  customerName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  businessAddress: string,
  eventId: string,
  language: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        email,
        customerName,
        businessName,
        startDate,
        endDate,
        paymentStatus,
        paymentAmount,
        businessAddress,
        eventId,
        language
      }
    });

    if (error) {
      console.error('Error sending booking approval email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending booking approval email:', error);
    return { success: false, error: error.message };
  }
};

export const sendBookingConfirmationEmail = async (
  email: string,
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
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        email,
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
      console.error('Error sending booking confirmation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending booking confirmation email:', error);
    return { success: false, error: error.message };
  }
};

export const sendEventCreationEmail = async (
  email: string,
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
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        email,
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

export const sendBookingConfirmationToMultipleRecipients = async (
  recipients: Array<{ email: string; name: string }>,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  businessAddress: string,
  eventId: string,
  language: string,
  eventNotes: string
): Promise<{ successful: number; failed: number; total: number }> => {
  try {
    let successful = 0;
    let failed = 0;
    
    for (const recipient of recipients) {
      const result = await sendEventCreationEmail(
        recipient.email,
        recipient.name,
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
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }
    
    return {
      successful,
      failed,
      total: recipients.length
    };
  } catch (error: any) {
    console.error('Error sending multiple booking confirmations:', error);
    return {
      successful: 0,
      failed: recipients.length,
      total: recipients.length
    };
  }
};

// Task API functions
export const getTasks = async (): Promise<Task[]> => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((task: any) => ({
      id: task.id,
      user_id: task.user_id,
      title: task.title,
      description: task.description,
      status: task.status as 'todo' | 'in_progress' | 'completed',
      priority: task.priority || 'medium',
      due_date: task.due_date,
      created_at: task.created_at,
      updated_at: task.updated_at || task.created_at,
      is_archived: task.archived || false,
      position: task.position || 0,
      deadline_at: task.deadline_at,
      reminder_at: task.reminder_at,
      email_reminder: task.email_reminder || false,
      reminder_sent: task.reminder_sent || false,
      archived: task.archived || false,
      archived_at: task.archived_at,
      deleted_at: task.deleted_at
    }));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
};

export const getArchivedTasks = async (): Promise<Task[]> => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('archived', true)
      .is('deleted_at', null)
      .order('archived_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((task: any) => ({
      id: task.id,
      user_id: task.user_id,
      title: task.title,
      description: task.description,
      status: task.status as 'todo' | 'in_progress' | 'completed',
      priority: task.priority || 'medium',
      due_date: task.due_date,
      created_at: task.created_at,
      updated_at: task.updated_at || task.created_at,
      is_archived: task.archived || false,
      position: task.position || 0,
      deadline_at: task.deadline_at,
      reminder_at: task.reminder_at,
      email_reminder: task.email_reminder || false,
      reminder_sent: task.reminder_sent || false,
      archived: task.archived || false,
      archived_at: task.archived_at,
      deleted_at: task.deleted_at
    }));
  } catch (error) {
    console.error('Error fetching archived tasks:', error);
    return [];
  }
};

export const createTask = async (task: Partial<Task>): Promise<Task> => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...task,
        archived: false
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      description: data.description,
      status: data.status as 'todo' | 'in_progress' | 'completed',
      priority: data.priority || 'medium',
      due_date: data.due_date,
      created_at: data.created_at,
      updated_at: data.updated_at || data.created_at,
      is_archived: data.archived || false,
      position: data.position || 0,
      deadline_at: data.deadline_at,
      reminder_at: data.reminder_at,
      email_reminder: data.email_reminder || false,
      reminder_sent: data.reminder_sent || false,
      archived: data.archived || false,
      archived_at: data.archived_at,
      deleted_at: data.deleted_at
    };
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<Task> => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      description: data.description,
      status: data.status as 'todo' | 'in_progress' | 'completed',
      priority: data.priority || 'medium',
      due_date: data.due_date,
      created_at: data.created_at,
      updated_at: data.updated_at || data.created_at,
      is_archived: data.archived || false,
      position: data.position || 0,
      deadline_at: data.deadline_at,
      reminder_at: data.reminder_at,
      email_reminder: data.email_reminder || false,
      reminder_sent: data.reminder_sent || false,
      archived: data.archived || false,
      archived_at: data.archived_at,
      deleted_at: data.deleted_at
    };
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

export const deleteTask = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

export const archiveTask = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ 
        archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error archiving task:', error);
    throw error;
  }
};

export const restoreTask = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ 
        archived: false,
        archived_at: null
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error restoring task:', error);
    throw error;
  }
};

// Note API functions
export const getNotes = async (): Promise<Note[]> => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
};

export const createNote = async (note: Partial<Note>): Promise<Note> => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .insert(note)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating note:', error);
    throw error;
  }
};

export const updateNote = async (id: string, updates: Partial<Note>): Promise<Note> => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
};

export const deleteNote = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

// Reminder API functions
export const getReminders = async (): Promise<Reminder[]> => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('remind_at', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return [];
  }
};

export const createReminder = async (reminder: Partial<Reminder>): Promise<Reminder> => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .insert(reminder)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating reminder:', error);
    throw error;
  }
};

export const updateReminder = async (id: string, updates: Partial<Reminder>): Promise<Reminder> => {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating reminder:', error);
    throw error;
  }
};

export const deleteReminder = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting reminder:', error);
    throw error;
  }
};
