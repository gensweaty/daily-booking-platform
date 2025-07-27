
import { supabase } from "@/integrations/supabase/client";

// Tasks API
export const getTasks = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // Map database fields to TypeScript interface with proper type casting
  return (data || []).map(task => ({
    id: task.id,
    user_id: task.user_id,
    title: task.title,
    description: task.description || '',
    status: task.status as 'todo' | 'in_progress' | 'completed',
    priority: task.priority as 'low' | 'medium' | 'high' | undefined,
    due_date: task.due_date,
    created_at: task.created_at,
    updated_at: task.updated_at || task.created_at,
    is_archived: task.is_archived || false,
    position: task.position || 0,
    deadline_at: task.deadline_at,
    reminder_at: task.reminder_at,
    email_reminder: task.email_reminder || false,
    reminder_sent: task.reminder_sent || false,
    archived: task.archived || false,
    archived_at: task.archived_at,
    deleted_at: task.deleted_at,
  }));
};

export const createTask = async (taskData: {
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed';
  user_id: string;
  position?: number;
  deadline_at?: string | null;
  reminder_at?: string | null;
  email_reminder?: boolean;
  reminder_sent?: boolean;
}) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    description: data.description || '',
    status: data.status as 'todo' | 'in_progress' | 'completed',
    priority: data.priority as 'low' | 'medium' | 'high' | undefined,
    due_date: data.due_date,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
    is_archived: data.is_archived || false,
    position: data.position || 0,
    deadline_at: data.deadline_at,
    reminder_at: data.reminder_at,
    email_reminder: data.email_reminder || false,
    reminder_sent: data.reminder_sent || false,
    archived: data.archived || false,
    archived_at: data.archived_at,
    deleted_at: data.deleted_at,
  };
};

export const updateTask = async (id: string, updates: any) => {
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
    description: data.description || '',
    status: data.status as 'todo' | 'in_progress' | 'completed',
    priority: data.priority as 'low' | 'medium' | 'high' | undefined,
    due_date: data.due_date,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
    is_archived: data.is_archived || false,
    position: data.position || 0,
    deadline_at: data.deadline_at,
    reminder_at: data.reminder_at,
    email_reminder: data.email_reminder || false,
    reminder_sent: data.reminder_sent || false,
    archived: data.archived || false,
    archived_at: data.archived_at,
    deleted_at: data.deleted_at,
  };
};

export const deleteTask = async (id: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return data;
};

export const getTasksForUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map(task => ({
    id: task.id,
    user_id: task.user_id,
    title: task.title,
    description: task.description || '',
    status: task.status as 'todo' | 'in_progress' | 'completed',
    priority: task.priority as 'low' | 'medium' | 'high' | undefined,
    due_date: task.due_date,
    created_at: task.created_at,
    updated_at: task.updated_at || task.created_at,
    is_archived: task.is_archived || false,
    position: task.position || 0,
    deadline_at: task.deadline_at,
    reminder_at: task.reminder_at,
    email_reminder: task.email_reminder || false,
    reminder_sent: task.reminder_sent || false,
    archived: task.archived || false,
    archived_at: task.archived_at,
    deleted_at: task.deleted_at,
  }));
};

export const archiveTask = async (taskId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ is_archived: true })
    .eq('id', taskId);

  if (error) throw error;
  return data;
};

export const getArchivedTasks = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_archived', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map(task => ({
    id: task.id,
    user_id: task.user_id,
    title: task.title,
    description: task.description || '',
    status: task.status as 'todo' | 'in_progress' | 'completed',
    priority: task.priority as 'low' | 'medium' | 'high' | undefined,
    due_date: task.due_date,
    created_at: task.created_at,
    updated_at: task.updated_at || task.created_at,
    is_archived: task.is_archived || false,
    position: task.position || 0,
    deadline_at: task.deadline_at,
    reminder_at: task.reminder_at,
    email_reminder: task.email_reminder || false,
    reminder_sent: task.reminder_sent || false,
    archived: task.archived || false,
    archived_at: task.archived_at,
    deleted_at: task.deleted_at,
  }));
};

export const restoreTask = async (taskId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ is_archived: false })
    .eq('id', taskId);

  if (error) throw error;
  return data;
};

// Notes API
export const getNotes = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map(note => ({
    id: note.id,
    user_id: note.user_id,
    title: note.title,
    content: note.content || '',
    created_at: note.created_at,
    updated_at: note.updated_at || note.created_at,
    color: note.color,
  }));
};

export const createNote = async (noteData: {
  title: string;
  content?: string;
  user_id: string;
  color?: string;
}) => {
  const { data, error } = await supabase
    .from('notes')
    .insert(noteData)
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    content: data.content || '',
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
    color: data.color,
  };
};

export const updateNote = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    content: data.content || '',
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
    color: data.color,
  };
};

export const deleteNote = async (id: string) => {
  const { data, error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return data;
};

// Reminders API
export const getReminders = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map(reminder => ({
    id: reminder.id,
    user_id: reminder.user_id,
    title: reminder.title,
    description: reminder.description,
    reminder_date: reminder.reminder_date,
    reminder_time: reminder.reminder_time,
    is_completed: reminder.is_completed,
    created_at: reminder.created_at,
    updated_at: reminder.updated_at || reminder.created_at,
    remind_at: reminder.remind_at,
  }));
};

export const createReminder = async (reminderData: {
  title: string;
  description?: string;
  remind_at: string;
  user_id: string;
}) => {
  const { data, error } = await supabase
    .from('reminders')
    .insert(reminderData)
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    description: data.description,
    reminder_date: data.reminder_date,
    reminder_time: data.reminder_time,
    is_completed: data.is_completed,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
    remind_at: data.remind_at,
  };
};

export const updateReminder = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('reminders')
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
    reminder_date: data.reminder_date,
    reminder_time: data.reminder_time,
    is_completed: data.is_completed,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
    remind_at: data.remind_at,
  };
};

export const deleteReminder = async (id: string) => {
  const { data, error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return data;
};

// Email API functions
export const sendEventCreationEmail = async (
  customerEmail: string,
  customerName: string,
  businessName: string,
  eventStartDate: string,
  eventEndDate: string,
  paymentStatus: string,
  paymentAmount: number | null,
  businessAddress: string,
  eventId: string,
  language: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-request-notification', {
      body: {
        customerEmail,
        customerName,
        businessName,
        eventStartDate,
        eventEndDate,
        paymentStatus,
        paymentAmount,
        businessAddress,
        eventId,
        language
      }
    });

    if (error) {
      console.error('Error sending event creation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in sendEventCreationEmail:', error);
    return { success: false, error: error.message };
  }
};

export const sendBookingConfirmationEmail = async (
  customerEmail: string,
  customerName: string,
  eventDate: string,
  eventTime: string,
  eventService: string,
  eventLocation: string,
  eventPrice: string,
  eventDescription: string,
  businessName: string,
  businessEmail: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-approval-email', {
      body: {
        customerEmail,
        customerName,
        eventDate,
        eventTime,
        eventService,
        eventLocation,
        eventPrice,
        eventDescription,
        businessName,
        businessEmail
      }
    });

    if (error) {
      console.error('Error sending booking confirmation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in sendBookingConfirmationEmail:', error);
    return { success: false, error: error.message };
  }
};

export const sendBookingConfirmationToMultipleRecipients = async (
  recipients: string[],
  eventData: any
) => {
  try {
    const results = await Promise.allSettled(
      recipients.map(email => 
        sendBookingConfirmationEmail(
          email,
          eventData.customerName,
          eventData.eventDate,
          eventData.eventTime,
          eventData.eventService,
          eventData.eventLocation,
          eventData.eventPrice,
          eventData.eventDescription,
          eventData.businessName,
          eventData.businessEmail
        )
      )
    );

    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    const total = recipients.length;

    return { successful, failed, total };
  } catch (error) {
    console.error('Error in sendBookingConfirmationToMultipleRecipients:', error);
    return { successful: 0, failed: recipients.length, total: recipients.length };
  }
};

export const deleteCustomer = async (customerId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting customer:', error);
      return { successful: false, failed: 1, total: 1 };
    }

    return { successful: 1, failed: 0, total: 1 };
  } catch (error) {
    console.error('Error in deleteCustomer:', error);
    return { successful: 0, failed: 1, total: 1 };
  }
};
