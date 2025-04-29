
import { Task, Note, Reminder, CalendarEvent } from "@/lib/types";
import { supabase, normalizeFilePath } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";

const BOOKING_RATE_LIMIT_KEY = "lastBookingTimestamp";
const BOOKING_RATE_LIMIT_SECONDS = 60;

export const rateLimitActive = () => {
  const lastTimestamp = localStorage.getItem(BOOKING_RATE_LIMIT_KEY);
  if (!lastTimestamp) return false;
  
  const now = Date.now();
  const elapsed = now - parseInt(lastTimestamp, 10);
  return elapsed < BOOKING_RATE_LIMIT_SECONDS * 1000;
};

export const isBookingFormBlocked = () => {
  return rateLimitActive();
};

export const checkRateLimit = () => {
  const lastTimestamp = localStorage.getItem(BOOKING_RATE_LIMIT_KEY);
  
  if (lastTimestamp) {
    const now = Date.now();
    const elapsed = now - parseInt(lastTimestamp, 10);
    
    if (elapsed < BOOKING_RATE_LIMIT_SECONDS * 1000) {
      const remainingSeconds = Math.ceil((BOOKING_RATE_LIMIT_SECONDS * 1000 - elapsed) / 1000);
      throw new Error(`Please wait ${remainingSeconds} seconds before submitting another request`);
    }
  }
  
  return true;
};

export const updateRateLimitTimestamp = () => {
  const now = Date.now();
  localStorage.setItem(BOOKING_RATE_LIMIT_KEY, now.toString());
};

export const resetRateLimit = () => {
  localStorage.removeItem(BOOKING_RATE_LIMIT_KEY);
};

export const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id">, file?: File) => {
  // Get current user if available
  const { data: userData } = await supabase.auth.getUser();
  
  console.log("Creating booking request:", request);
  console.log("File attached:", file ? file.name : "No file");
  
  try {
    // Check rate limit before creating booking
    checkRateLimit();
    
    // Add user ID if authenticated
    const bookingData = {
      ...request,
      user_id: userData?.user?.id || null,
    };
    
    const { data, error } = await supabase
      .from("booking_requests")
      .insert(bookingData)
      .select()
      .single();
    
    if (error) {
      console.error("Error creating booking request:", error);
      throw error;
    }
    
    // Handle file upload if a file is provided
    if (file && data?.id) {
      try {
        console.log("Uploading file for booking request:", file.name);
        
        // Generate a unique filename
        const fileExt = file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        // Upload the file to storage
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, file);
          
        if (uploadError) {
          console.error("Error uploading file:", uploadError);
          throw uploadError;
        }
        
        // Create a file record in the database linked to the booking request
        const fileData = {
          filename: file.name,
          file_path: filePath,
          content_type: file.type,
          size: file.size,
          event_id: data.id,
          user_id: userData?.user?.id || null
        };
        
        const { error: fileRecordError } = await supabase
          .from('event_files')
          .insert(fileData);
          
        if (fileRecordError) {
          console.error("Error creating file record:", fileRecordError);
          throw fileRecordError;
        }
        
        console.log("File uploaded and associated with booking request:", data.id);
      } catch (fileError) {
        console.error("Error handling file upload:", fileError);
        // Continue even if file upload fails, we've already created the booking request
      }
    }
    
    // Store current timestamp in localStorage for rate limiting
    updateRateLimitTimestamp();
    
    return data;
  } catch (error) {
    console.error("Error in createBookingRequest:", error);
    throw error;
  }
};

export const getPublicBusinessProfile = async (slug: string) => {
  console.log("Fetching business profile for:", slug);
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("Error fetching public business profile:", error);
    throw error;
  }

  return data;
};

// Add the missing API functions below

// Task related functions
export const getTasks = async (): Promise<Task[]> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('position', { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }

  return data || [];
};

export const createTask = async (task: Partial<Task>): Promise<Task> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) {
    throw new Error("User not authenticated");
  }

  // Get the count of existing tasks to determine position
  const { count, error: countError } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userData.user.id);

  if (countError) {
    console.error("Error counting tasks:", countError);
    throw countError;
  }

  const position = count || 0;

  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, user_id: userData.user.id, position })
    .select()
    .single();

  if (error) {
    console.error("Error creating task:", error);
    throw error;
  }

  return data;
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<Task> => {
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

export const deleteTask = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting task:", error);
    throw error;
  }
};

// Note related functions
export const getNotes = async (): Promise<Note[]> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching notes:", error);
    throw error;
  }

  return data || [];
};

export const createNote = async (note: Partial<Note>): Promise<Note> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({ ...note, user_id: userData.user.id })
    .select()
    .single();

  if (error) {
    console.error("Error creating note:", error);
    throw error;
  }

  return data;
};

export const updateNote = async (id: string, updates: Partial<Note>): Promise<Note> => {
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

export const deleteNote = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting note:", error);
    throw error;
  }
};

// Reminder related functions
export const getReminders = async (): Promise<Reminder[]> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('remind_at', { ascending: true });

  if (error) {
    console.error("Error fetching reminders:", error);
    throw error;
  }

  return data || [];
};

export const createReminder = async (reminder: Partial<Reminder>): Promise<Reminder> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert({ ...reminder, user_id: userData.user.id })
    .select()
    .single();

  if (error) {
    console.error("Error creating reminder:", error);
    throw error;
  }

  return data;
};

export const updateReminder = async (id: string, updates: Partial<Reminder>): Promise<Reminder> => {
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

export const deleteReminder = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting reminder:", error);
    throw error;
  }
};

// Calendar events related functions
export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    console.log("Fetching public calendar events for business:", businessId);
    
    // Get public events for the business user
    const { data: eventsData, error: eventsError } = await supabase
      .rpc('get_public_calendar_events', { p_business_id: businessId });
    
    if (eventsError) {
      console.error("Error fetching public events:", eventsError);
      throw eventsError;
    }
    
    // Get approved booking requests
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .is('deleted_at', null);
    
    if (bookingsError) {
      console.error("Error fetching approved bookings:", bookingsError);
      throw bookingsError;
    }
    
    return {
      events: eventsData || [],
      bookings: bookingsData || []
    };
  } catch (error) {
    console.error("Error in getPublicCalendarEvents:", error);
    throw error;
  }
};
