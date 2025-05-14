
// Add to the testEmailSending function the eventNotes parameter
import { supabase } from "./supabase";
import { Reminder, Task, Note } from "./types";

export const testEmailSending = async (
  toEmail: string,
  fullName: string,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus?: string,
  paymentAmount?: number | null,
  businessAddress?: string,
  eventId?: string,
  source?: string,
  language?: string,
  eventNotes?: string // Add the event notes parameter
) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    if (!accessToken) {
      return { error: "No authentication token available" };
    }
    
    // Create the request payload with event notes
    const payload = {
      recipientEmail: toEmail,
      fullName,
      businessName,
      startDate,
      endDate,
      paymentStatus,
      paymentAmount,
      businessAddress,
      eventId,
      source: source || 'manual',
      language,
      eventNotes // Include event notes in the payload
    };
    
    // Log data being sent (with masked email)
    console.log('Sending email with data:', {
      ...payload,
      recipientEmail: toEmail.substring(0, 3) + '***',
      eventNotes: eventNotes ? 'present' : 'not present'
    });
    
    const response = await fetch(
      "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      }
    );
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error sending test email:", error);
    return { error: "Failed to send email" };
  }
};

// Add missing task-related functions
export const createTask = async (taskData: Partial<Task>) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([taskData])
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

export const getTasks = async () => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const deleteTask = async (id: string) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
};

// Add missing reminder-related functions
export const createReminder = async (reminderData: Partial<Reminder>) => {
  const { data, error } = await supabase
    .from('reminders')
    .insert([reminderData])
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

export const getReminders = async () => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('remind_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const deleteReminder = async (id: string) => {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
};

// Add missing note-related functions
export const createNote = async (noteData: Partial<Note>) => {
  const { data, error } = await supabase
    .from('notes')
    .insert([noteData])
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

export const getNotes = async () => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const deleteNote = async (id: string) => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
};

// Add public calendar events function
export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    // Call the RPC function to get public calendar events
    const { data, error } = await supabase.rpc('get_public_calendar_events', {
      p_business_id: businessId
    });
    
    if (error) {
      console.error('Error fetching public calendar events:', error);
      throw error;
    }
    
    // Format the response correctly
    return {
      events: data?.events || [],
      bookings: data?.bookings || []
    };
  } catch (error) {
    console.error('Exception in getPublicCalendarEvents:', error);
    return { events: [], bookings: [] };
  }
};
