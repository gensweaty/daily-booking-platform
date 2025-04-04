import { supabase } from "./supabase";

export const getTasks = async () => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('order', { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }

  return data || [];
};

export const createTask = async (title: string, userId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ title, user_id: userId }])
    .select()
    .single();

  if (error) {
    console.error("Error creating task:", error);
    throw error;
  }

  return data;
};

export const updateTask = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating task:", error);
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
    console.error("Error deleting task:", error);
    throw error;
  }
};

export const getReminders = async (userId: string) => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('remind_at', { ascending: true });

  if (error) {
    console.error("Error fetching reminders:", error);
    return [];
  }

  return data || [];
};

export const createReminder = async (reminder: any) => {
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

export const updateReminder = async (id: string, updates: any) => {
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

export const deleteReminder = async (id: string) => {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting reminder:", error);
    throw error;
  }
};

export const getNotes = async (userId: string) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching notes:", error);
    return [];
  }

  return data || [];
};

export const createNote = async (note: any) => {
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

export const updateNote = async (id: string, updates: any) => {
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

export const deleteNote = async (id: string) => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting note:", error);
    throw error;
  }
};

export const getBusinessProfileBySlug = async (slug: string) => {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error("Error fetching business profile:", error);
    return null;
  }

  return data;
};

export const getBusinessProfileById = async (id: string) => {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error("Error fetching business profile:", error);
    return null;
  }

  return data;
};

export const getBusinessProfilesByUserId = async (userId: string) => {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error("Error fetching business profiles:", error);
    return [];
  }

  return data || [];
};

export const createBusinessProfile = async (profile: any) => {
  const { data, error } = await supabase
    .from('business_profiles')
    .insert([profile])
    .select()
    .single();

  if (error) {
    console.error("Error creating business profile:", error);
    throw error;
  }

  return data;
};

export const updateBusinessProfile = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('business_profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating business profile:", error);
    throw error;
  }

  return data;
};

export const deleteBusinessProfile = async (id: string) => {
  const { error } = await supabase
    .from('business_profiles')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting business profile:", error);
    throw error;
  }
};

export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    const { data, error } = await supabase.rpc('get_public_events_by_business_id', {
      business_id_param: businessId
    });

    if (error) {
      console.error('Error calling get_public_events_by_business_id:', error);
      throw error;
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved');

    if (bookingsError) {
      console.error('Error fetching approved bookings:', bookingsError);
      throw bookingsError;
    }

    return {
      events: data || [],
      bookings: bookings || []
    };
  } catch (error) {
    console.error('Exception in getPublicCalendarEvents:', error);
    return { events: [], bookings: [] };
  }
};

export const createBookingRequest = async (bookingData: {
  title: string;
  requester_name: string;
  requester_email: string;
  requester_phone?: string;
  description?: string;
  start_date: string;
  end_date: string;
  payment_amount?: number | null;
  business_id: string;
}) => {
  try {
    const { data, error } = await supabase
      .from('booking_requests')
      .insert({
        title: bookingData.title,
        requester_name: bookingData.requester_name,
        requester_email: bookingData.requester_email,
        requester_phone: bookingData.requester_phone || null,
        description: bookingData.description || null,
        start_date: bookingData.start_date,
        end_date: bookingData.end_date,
        business_id: bookingData.business_id,
        status: 'pending',
        payment_amount: bookingData.payment_amount || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking request:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Exception in createBookingRequest:', error);
    throw error;
  }
};
