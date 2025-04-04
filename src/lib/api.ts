
import { supabase } from "./supabase";
import { Task, Note, Reminder } from "./types";
import { CalendarEventType } from "./types/calendar";

// Calendar events for public display
export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    // Get the business owner's user ID first
    const { data: businessProfile, error: profileError } = await supabase
      .from("business_profiles")
      .select("user_id")
      .eq("id", businessId)
      .single();
    
    if (profileError) {
      console.error("Error fetching business profile:", profileError);
      throw profileError;
    }
    
    if (!businessProfile?.user_id) {
      console.error("No user ID found for business:", businessId);
      return { events: [], bookings: [] };
    }
    
    const businessUserId = businessProfile.user_id;
    console.log("Fetching events for business user ID:", businessUserId);
    
    // Fetch regular events for the business owner
    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", businessUserId);
    
    if (eventsError) {
      console.error("Error fetching user events:", eventsError);
      throw eventsError;
    }
    
    console.log(`Fetched ${eventsData?.length || 0} regular events for business user`);
    
    // Then fetch approved booking requests
    const { data: bookingsData, error: bookingsError } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "approved");
    
    if (bookingsError) {
      console.error("Error fetching approved bookings:", bookingsError);
      throw bookingsError;
    }
    
    console.log(`Fetched ${bookingsData?.length || 0} approved booking requests`);
    
    return {
      events: eventsData || [],
      bookings: bookingsData || []
    };
  } catch (error: any) {
    console.error("Error fetching public calendar events:", error);
    throw new Error(error.message || "Failed to fetch public calendar events");
  }
};

// Tasks API functions
export const getTasks = async () => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("position", { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    throw new Error(error.message || "Failed to fetch tasks");
  }
};

export const createTask = async (taskData: Omit<Task, "id" | "created_at">) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .insert(taskData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating task:", error);
    throw new Error(error.message || "Failed to create task");
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
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error updating task:", error);
    throw new Error(error.message || "Failed to update task");
  }
};

export const deleteTask = async (id: string) => {
  try {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("Error deleting task:", error);
    throw new Error(error.message || "Failed to delete task");
  }
};

// Notes API functions
export const getNotes = async () => {
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching notes:", error);
    throw new Error(error.message || "Failed to fetch notes");
  }
};

export const createNote = async (noteData: Omit<Note, "id" | "created_at">) => {
  try {
    const { data, error } = await supabase
      .from("notes")
      .insert(noteData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating note:", error);
    throw new Error(error.message || "Failed to create note");
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
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error updating note:", error);
    throw new Error(error.message || "Failed to update note");
  }
};

export const deleteNote = async (id: string) => {
  try {
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("Error deleting note:", error);
    throw new Error(error.message || "Failed to delete note");
  }
};

// Reminders API functions
export const getReminders = async () => {
  try {
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .order("date", { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching reminders:", error);
    throw new Error(error.message || "Failed to fetch reminders");
  }
};

export const createReminder = async (reminderData: Omit<Reminder, "id" | "created_at">) => {
  try {
    const { data, error } = await supabase
      .from("reminders")
      .insert(reminderData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating reminder:", error);
    throw new Error(error.message || "Failed to create reminder");
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
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error updating reminder:", error);
    throw new Error(error.message || "Failed to update reminder");
  }
};

export const deleteReminder = async (id: string) => {
  try {
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("Error deleting reminder:", error);
    throw new Error(error.message || "Failed to delete reminder");
  }
};

// Booking requests API functions
export const createBookingRequest = async (
  bookingData: {
    start_date: string;
    end_date: string;
    payment_amount: number | null;
    business_id: string;
    requester_name?: string;
    requester_email?: string;
    requester_phone?: string;
    title?: string;
    description?: string;
  }
) => {
  try {
    const { data, error } = await supabase
      .from("booking_requests")
      .insert(bookingData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating booking request:", error);
    throw new Error(error.message || "Failed to create booking request");
  }
};

// Fix the type issue with the Calendar component
export const defineCalendarPropsForExport = () => {
  return {
    isExternalCalendar: false,
    businessId: '',
    businessUserId: '',
    allowBookingRequests: false,
    directEvents: [],
    fetchedEvents: [],
    events: [],
    view: 'month' as 'month' | 'week' | 'day'
  };
};
