
import { supabase } from "@/lib/supabase";
import { Task, Note, Reminder } from "@/lib/types";

// Tasks API
export const getTasks = async () => {
  try {
    // Get user ID from session to ensure filtering
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      console.error("No authenticated user found");
      return [];
    }

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId) // FIXED: Added strict user filtering
      .order("position", { ascending: true });

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
    // Get user ID from session to ensure we create for current user
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error("No authenticated user found");
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert([{ ...taskData, user_id: userId }]) // FIXED: Ensure user_id is set
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
    // Get user ID from session for validation
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error("No authenticated user found");
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId) // FIXED: Only update user's own tasks
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
    // Get user ID from session for validation
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error("No authenticated user found");
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", userId); // FIXED: Only delete user's own tasks

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
    // Get user ID from session to ensure filtering
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      console.error("No authenticated user found");
      return [];
    }

    const { data: notes, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId); // FIXED: Added strict user filtering

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
    // Get user ID from session to ensure we create for current user
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error("No authenticated user found");
    }

    const { data, error } = await supabase
      .from("notes")
      .insert([{ ...noteData, user_id: userId }]) // FIXED: Ensure user_id is set
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
    // Get user ID from session for validation
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error("No authenticated user found");
    }

    const { data, error } = await supabase
      .from("notes")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId) // FIXED: Only update user's own notes
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
    // Get user ID from session for validation
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error("No authenticated user found");
    }

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId); // FIXED: Only delete user's own notes

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
    // Get user ID from session to ensure filtering
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      console.error("No authenticated user found");
      return [];
    }

    const { data: reminders, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId); // FIXED: Added strict user filtering

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
    // Get user ID from session to ensure we create for current user
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error("No authenticated user found");
    }

    const { data, error } = await supabase
      .from("reminders")
      .insert([{ ...reminderData, user_id: userId }]) // FIXED: Ensure user_id is set
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
    // Get user ID from session for validation
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error("No authenticated user found");
    }

    const { data, error } = await supabase
      .from("reminders")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId) // FIXED: Only update user's own reminders
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
    // Get user ID from session for validation
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error("No authenticated user found");
    }

    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id)
      .eq("user_id", userId); // FIXED: Only delete user's own reminders

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

    // Get events for this user only
    const { data: eventData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', businessData.user_id)  // FIXED: Strict filtering by user_id
      .is('deleted_at', null) // Only fetch non-deleted events
      .order('start_date', { ascending: true });

    if (eventsError) {
      console.error("[API] Error fetching events:", eventsError);
      return { events: [], bookings: [] };
    }
    
    console.log(`[API] Fetched events count: ${eventData?.length || 0}`);
    
    // Get approved bookings for this business only
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
