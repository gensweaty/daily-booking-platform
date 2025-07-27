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
  return data;
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
  return data || [];
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
  return data || [];
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
  return data || [];
};

// Email API functions
export const sendEventCreationEmail = async (
  customerEmail: string,
  customerName: string,
  eventDate: string,
  eventTime: string,
  eventService: string,
  eventLocation: string,
  eventPrice: string,
  eventDescription: string,
  businessName: string,
  businessEmail: string,
  businessPhone: string
) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-request-notification', {
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
        businessEmail,
        businessPhone
      }
    });

    if (error) {
      console.error('Error sending event creation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
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
  businessEmail: string,
  businessPhone: string
) => {
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
        businessEmail,
        businessPhone
      }
    });

    if (error) {
      console.error('Error sending booking confirmation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
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
          eventData.businessEmail,
          eventData.businessPhone
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

export const deleteCustomer = async (customerId: string, userId: string) => {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)
      .eq('user_id', userId);

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
