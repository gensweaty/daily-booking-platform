import { Task, Note, Reminder, CalendarEvent } from "@/lib/types";
import { supabase, normalizeFilePath } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";

// Helper function to get file URL with consistent bucket handling
export const getFileUrl = (bucketName: string, filePath: string) => {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const normalizedPath = normalizeFilePath(filePath);
  
  // Better bucket determination logic based on file path patterns
  let effectiveBucket = bucketName;
  
  // Files with b22b pattern (UUID format) or timestamp patterns are always from event_attachments
  if (filePath && (filePath.includes("b22b") || /^\d{13}_/.test(filePath))) {
    effectiveBucket = "event_attachments";
  }
  
  return `${baseUrl}/storage/v1/object/public/${effectiveBucket}/${normalizedPath}`;
};

export const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id">) => {
  // Get current user if available
  const { data: userData } = await supabase.auth.getUser();
  
  console.log("Creating booking request:", request);
  
  try {
    // Ensure payment_amount is properly handled when saving to the database
    const bookingData = {
      ...request,
      status: 'pending',
      user_id: userData?.user?.id || null // Allow null for public bookings
    };
    
    // Make sure payment_amount is correctly formatted as a number or null
    if (request.payment_amount !== undefined && request.payment_amount !== null) {
      // Convert to number regardless of input type
      const parsedAmount = Number(request.payment_amount);
      bookingData.payment_amount = isNaN(parsedAmount) ? null : parsedAmount;
    } else {
      // Explicitly set to null to avoid database errors
      bookingData.payment_amount = null;
    }
    
    const { data, error } = await supabase
      .from("booking_requests")
      .insert([bookingData])
      .select()
      .single();

    if (error) {
      console.error("Error creating booking request:", error);
      throw error;
    }
    
    console.log("Created booking request:", data);
    return data;
  } catch (error: any) {
    console.error("Error in createBookingRequest:", error);
    throw new Error(error.message || "Failed to create booking request");
  }
};

// Task related functions
export const getTasks = async (): Promise<Task[]> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData?.user) {
      throw new Error("User not authenticated");
    }
    
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("position", { ascending: true });
      
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    throw new Error(error.message || "Failed to fetch tasks");
  }
};

export const createTask = async (task: Omit<Task, "id" | "created_at">): Promise<Task> => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .insert([task])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating task:", error);
    throw new Error(error.message || "Failed to create task");
  }
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<Task> => {
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

export const deleteTask = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);
      
    if (error) throw error;
  } catch (error: any) {
    console.error("Error deleting task:", error);
    throw new Error(error.message || "Failed to delete task");
  }
};

// Note related functions
export const getNotes = async (): Promise<Note[]> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData?.user) {
      throw new Error("User not authenticated");
    }
    
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching notes:", error);
    throw new Error(error.message || "Failed to fetch notes");
  }
};

export const createNote = async (note: Omit<Note, "id" | "created_at">): Promise<Note> => {
  try {
    const { data, error } = await supabase
      .from("notes")
      .insert([note])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating note:", error);
    throw new Error(error.message || "Failed to create note");
  }
};

export const updateNote = async (id: string, updates: Partial<Note>): Promise<Note> => {
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

export const deleteNote = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id);
      
    if (error) throw error;
  } catch (error: any) {
    console.error("Error deleting note:", error);
    throw new Error(error.message || "Failed to delete note");
  }
};

// Reminder related functions
export const getReminders = async (): Promise<Reminder[]> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData?.user) {
      throw new Error("User not authenticated");
    }
    
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("remind_at", { ascending: true });
      
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching reminders:", error);
    throw new Error(error.message || "Failed to fetch reminders");
  }
};

export const createReminder = async (reminder: Omit<Reminder, "id" | "created_at">): Promise<Reminder> => {
  try {
    const { data, error } = await supabase
      .from("reminders")
      .insert([reminder])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Error creating reminder:", error);
    throw new Error(error.message || "Failed to create reminder");
  }
};

export const updateReminder = async (id: string, updates: Partial<Reminder>): Promise<Reminder> => {
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

export const deleteReminder = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id);
      
    if (error) throw error;
  } catch (error: any) {
    console.error("Error deleting reminder:", error);
    throw new Error(error.message || "Failed to delete reminder");
  }
};

// Calendar events for public display
export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    console.log("[getPublicCalendarEvents] Fetching for business ID:", businessId);
    
    // First fetch the business user ID
    const { data: business, error: businessError } = await supabase
      .from("business_profiles")
      .select("user_id")
      .eq("id", businessId)
      .single();
    
    if (businessError) {
      console.error("Error fetching business:", businessError);
      return { events: [], bookings: [] };
    }
    
    if (!business?.user_id) {
      console.error("No user ID found for business:", businessId);
      return { events: [], bookings: [] };
    }
    
    console.log("[getPublicCalendarEvents] Using business user ID:", business.user_id);
    
    // Use the security definer function to get events bypassing RLS
    const { data: events, error: eventsError } = await supabase
      .rpc('get_public_events_by_user_id', {
        user_id_param: business.user_id
      });
    
    if (eventsError) {
      console.error("Error fetching events with RPC:", eventsError);
      return { events: [], bookings: [] };
    }
    
    console.log(`[getPublicCalendarEvents] Fetched ${events?.length || 0} events via RPC function`);
    
    // Fetch approved booking requests
    const { data: bookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved');
    
    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
      return { events: events || [], bookings: [] };
    }
    
    console.log(`[getPublicCalendarEvents] Fetched ${bookings?.length || 0} approved bookings`);
    
    return { 
      events: events || [], 
      bookings: bookings || [] 
    };
  } catch (error) {
    console.error("Exception in getPublicCalendarEvents:", error);
    return { events: [], bookings: [] };
  }
};

// Enhanced file handling functions with consistent bucket handling
export const downloadFile = async (bucketName: string, filePath: string, fileName: string) => {
  try {
    console.log(`Attempting to download file from ${bucketName}/${filePath}`);
    
    // Improved bucket determination logic
    let effectiveBucket = bucketName;
    if (filePath && (filePath.includes("b22b") || /^\d{13}_/.test(filePath))) {
      effectiveBucket = "event_attachments";
    }
    console.log(`Using effective bucket: ${effectiveBucket}`);
    
    // Direct URL for download
    const directUrl = getFileUrl(effectiveBucket, filePath);
    console.log('Using direct URL for download:', directUrl);
    
    try {
      // Fetch the file as a blob
      const response = await fetch(directUrl);
      const blob = await response.blob();
      
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create and setup anchor element
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName; // Force download behavior
      a.style.display = 'none'; // Hide the element
      
      // Add to DOM, click, and remove
      document.body.appendChild(a);
      a.click();
      
      // Cleanup resources
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl); // Free up memory
      }, 100);
      
      return { success: true, message: 'Download started' };
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      // Fallback method as last resort
      const a = document.createElement('a');
      a.href = directUrl;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 100);
      
      return { success: true, message: 'Download started (fallback method)' };
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    return { success: false, message: 'Failed to download file' };
  }
};

export const openFile = async (bucketName: string, filePath: string) => {
  try {
    // Improved bucket determination
    let effectiveBucket = bucketName;
    if (filePath && (filePath.includes("b22b") || /^\d{13}_/.test(filePath))) {
      effectiveBucket = "event_attachments";
    }
    
    const directUrl = getFileUrl(effectiveBucket, filePath);
    
    console.log('Opening file with direct URL:', directUrl);
    
    // Open in a new tab to prevent navigation away from the current page
    window.open(directUrl, '_blank', 'noopener,noreferrer');
    
    return { success: true };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, message: 'Failed to open file' };
  }
};
