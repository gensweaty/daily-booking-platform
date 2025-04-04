
import { supabase } from "@/lib/supabase";
import { Task, Note, Reminder } from "@/lib/types";

// Tasks API
export const getTasks = async () => {
  try {
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*")
      .order("order");

    if (error) {
      console.error("Error fetching tasks:", error);
      throw error;
    }

    return tasks || [];
  } catch (err) {
    console.error("Exception in getTasks:", err);
    return [];
  }
};

export const createTask = async (taskData: Partial<Task>) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .insert([taskData])
      .select()
      .single();

    if (error) {
      console.error("Error creating task:", error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error("Exception in createTask:", err);
    throw err;
  }
};

export const updateTask = async (id: string, updates: Partial<Task>) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating task:", error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error("Exception in updateTask:", err);
    throw err;
  }
};

export const deleteTask = async (id: string) => {
  try {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting task:", error);
      throw error;
    }

    return true;
  } catch (err) {
    console.error("Exception in deleteTask:", err);
    throw err;
  }
};

// Notes API
export const getNotes = async () => {
  try {
    const { data: notes, error } = await supabase
      .from("notes")
      .select("*");

    if (error) {
      console.error("Error fetching notes:", error);
      throw error;
    }

    return notes || [];
  } catch (err) {
    console.error("Exception in getNotes:", err);
    return [];
  }
};

export const createNote = async (noteData: Partial<Note>) => {
  try {
    const { data, error } = await supabase
      .from("notes")
      .insert([noteData])
      .select()
      .single();

    if (error) {
      console.error("Error creating note:", error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error("Exception in createNote:", err);
    throw err;
  }
};

export const updateNote = async (id: string, updates: Partial<Note>) => {
  try {
    const { data, error } = await supabase
      .from("notes")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating note:", error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error("Exception in updateNote:", err);
    throw err;
  }
};

export const deleteNote = async (id: string) => {
  try {
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting note:", error);
      throw error;
    }

    return true;
  } catch (err) {
    console.error("Exception in deleteNote:", err);
    throw err;
  }
};

// Reminders API
export const getReminders = async () => {
  try {
    const { data: reminders, error } = await supabase
      .from("reminders")
      .select("*");

    if (error) {
      console.error("Error fetching reminders:", error);
      throw error;
    }

    return reminders || [];
  } catch (err) {
    console.error("Exception in getReminders:", err);
    return [];
  }
};

export const createReminder = async (reminderData: Partial<Reminder>) => {
  try {
    const { data, error } = await supabase
      .from("reminders")
      .insert([reminderData])
      .select()
      .single();

    if (error) {
      console.error("Error creating reminder:", error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error("Exception in createReminder:", err);
    throw err;
  }
};

export const updateReminder = async (id: string, updates: Partial<Reminder>) => {
  try {
    const { data, error } = await supabase
      .from("reminders")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating reminder:", error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error("Exception in updateReminder:", err);
    throw err;
  }
};

export const deleteReminder = async (id: string) => {
  try {
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting reminder:", error);
      throw error;
    }

    return true;
  } catch (err) {
    console.error("Exception in deleteReminder:", err);
    throw err;
  }
};

// Calendar events
export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    console.log("[API] Getting public calendar events for business:", businessId);
    
    // First get the user_id associated with this business
    const { data: businessData, error: businessError } = await supabase
      .from("business_profiles")
      .select("user_id")
      .eq("id", businessId)
      .single();
      
    if (businessError) {
      console.error("[API] Error fetching business profile:", businessError);
      return { events: [], bookings: [] };
    }
    
    if (!businessData?.user_id) {
      console.error("[API] No user_id found for business:", businessId);
      return { events: [], bookings: [] };
    }

    console.log("[API] Found business user_id:", businessData.user_id);

    // Get events for this user
    const { data: eventData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', businessData.user_id);  // Strict filtering by user_id

    if (eventsError) {
      console.error("[API] Error fetching events:", eventsError);
      return { events: [], bookings: [] };
    }
    
    console.log(`[API] Fetched events count: ${eventData?.length || 0}`);
    
    // Get approved bookings
    const { data: bookingData, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved');
      
    if (bookingsError) {
      console.error("[API] Error fetching booking requests:", bookingsError);
      return { events: eventData || [], bookings: [] };
    }
    
    console.log(`[API] Fetched approved bookings count: ${bookingData?.length || 0}`);
    
    return { 
      events: eventData || [], 
      bookings: bookingData || []
    };
  } catch (err) {
    console.error("[API] Exception in getPublicCalendarEvents:", err);
    return { events: [], bookings: [] };
  }
};
