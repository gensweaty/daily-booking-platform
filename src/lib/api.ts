
import { supabase } from './supabase';
import { Task, Reminder, Note, BookingRequest, BusinessProfile } from './types';

export const sendEventCreationEmail = async (
  requesterEmail: string,
  requesterName: string,
  eventTitle: string,
  eventDescription: string,
  startDate: string,
  endDate: string,
  businessName: string,
  businessEmail: string,
  isRecurring: boolean,
  userSurname: string,
  userNumber: string
) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-request-notification', {
      body: {
        requester_email: requesterEmail,
        requester_name: requesterName,
        event_title: eventTitle,
        event_description: eventDescription,
        start_date: startDate,
        end_date: endDate,
        business_name: businessName,
        business_email: businessEmail,
        is_recurring: isRecurring,
        user_surname: userSurname,
        user_number: userNumber
      }
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in sendEventCreationEmail:', error);
    return { success: false, error: 'Failed to send email' };
  }
};

export const deleteCustomer = async (
  customerId: string,
  businessId: string,
  requesterEmail: string,
  requesterName: string,
  eventTitle: string,
  eventDescription: string,
  startDate: string,
  endDate: string,
  businessName: string,
  businessEmail: string
) => {
  try {
    const { error } = await supabase
      .from('booking_requests')
      .delete()
      .eq('id', customerId);

    if (error) {
      console.error('Error deleting customer:', error);
      return { success: false, error: error.message };
    }

    // Send notification email
    const emailResult = await sendEventCreationEmail(
      requesterEmail,
      requesterName,
      eventTitle,
      eventDescription,
      startDate,
      endDate,
      businessName,
      businessEmail,
      false,
      '',
      ''
    );

    return { 
      successful: true, 
      total: 1,
      failed: emailResult.success ? 0 : 1
    };
  } catch (error) {
    console.error('Error in deleteCustomer:', error);
    return { 
      successful: false, 
      total: 1,
      failed: 1
    };
  }
};

export const getTasksForUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }

    return data as Task[];
  } catch (error) {
    console.error('Error in getTasksForUser:', error);
    throw error;
  }
};

export const createTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'user_id'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .insert([{ ...taskData, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTask = async (id: string, updates: Partial<Task>) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteTask = async (id: string) => {
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
};

export const createReminder = async (reminderData: Omit<Reminder, 'id' | 'created_at' | 'user_id'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('reminders')
    .insert([{ ...reminderData, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
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

export const createNote = async (noteData: Omit<Note, 'id' | 'created_at' | 'user_id'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('notes')
    .insert([{ ...noteData, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
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
