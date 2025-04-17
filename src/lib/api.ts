import { Task, Note, Reminder, CalendarEvent } from "@/lib/types";
import { supabase, normalizeFilePath } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";

// Improved file URL with better error handling and caching
export const getFileUrl = (bucketName: string, filePath: string) => {
  if (!filePath) return "";
  if (!bucketName) return "";
  
  // Use a cached URL if available
  const cacheKey = `file_url_${bucketName}_${filePath}`;
  const cachedUrl = sessionStorage.getItem(cacheKey);
  if (cachedUrl) return cachedUrl;
  
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const normalizedPath = normalizeFilePath(filePath);
  
  // Better bucket determination logic based on file path patterns
  let effectiveBucket = bucketName;
  
  // Files with b22b pattern (UUID format) or timestamp patterns are always from event_attachments
  if (filePath && (filePath.includes("b22b") || /^\d{13}_/.test(filePath))) {
    effectiveBucket = "event_attachments";
  }
  
  const url = `${baseUrl}/storage/v1/object/public/${effectiveBucket}/${normalizedPath}`;
  
  // Cache the URL for future use
  try {
    sessionStorage.setItem(cacheKey, url);
  } catch (e) {
    console.warn("Failed to cache file URL:", e);
  }
  
  return url;
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
  if (!businessId) {
    console.error("No business ID provided to getPublicCalendarEvents");
    return { events: [], bookings: [] };
  }
  
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
      
      // Try with cached user ID from session storage as fallback
      const cachedUserId = sessionStorage.getItem(`business_user_id_${businessId}`);
      if (cachedUserId) {
        console.log("[getPublicCalendarEvents] Using cached user ID:", cachedUserId);
        
        // Use the cached ID to get events
        return await fetchEventsWithUserId(cachedUserId, businessId);
      }
      
      return { events: [], bookings: [] };
    }
    
    if (!business?.user_id) {
      console.error("No user ID found for business:", businessId);
      return { events: [], bookings: [] };
    }
    
    console.log("[getPublicCalendarEvents] Using business user ID:", business.user_id);
    
    // Store the user ID in session storage for recovery
    sessionStorage.setItem(`business_user_id_${businessId}`, business.user_id);
    
    return await fetchEventsWithUserId(business.user_id, businessId);
  } catch (error) {
    console.error("Exception in getPublicCalendarEvents:", error);
    return { events: [], bookings: [] };
  }
};

// Helper function to fetch events with a user ID
const fetchEventsWithUserId = async (userId: string, businessId: string) => {
  try {
    // Use the security definer function to get events bypassing RLS
    const { data: events, error: eventsError } = await supabase
      .rpc('get_public_events_by_user_id', {
        user_id_param: userId
      });
    
    if (eventsError) {
      console.error("Error fetching events with RPC:", eventsError);
      return { events: [], bookings: [] };
    }
    
    console.log(`[getPublicCalendarEvents] Fetched ${events?.length || 0} events via RPC function`);
    
    // Fetch approved booking requests with retry logic
    let bookings = [];
    let bookingsError = null;
    let retryCount = 0;
    
    while (retryCount < 3) {
      const response = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved');
      
      if (!response.error) {
        bookings = response.data || [];
        break;
      } else {
        bookingsError = response.error;
        retryCount++;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (bookingsError) {
      console.error("Error fetching bookings after retries:", bookingsError);
    }
    
    console.log(`[getPublicCalendarEvents] Fetched ${bookings?.length || 0} approved bookings`);
    
    return { 
      events: events || [], 
      bookings: bookings || [] 
    };
  } catch (error) {
    console.error("Exception in fetchEventsWithUserId:", error);
    return { events: [], bookings: [] };
  }
};

// Enhanced file handling functions with better caching and error handling
export const downloadFile = async (bucketName: string, filePath: string, fileName: string) => {
  try {
    console.log(`Attempting to download file from ${bucketName}/${filePath}`);
    
    // Improved bucket determination logic
    let effectiveBucket = bucketName;
    if (filePath && (filePath.includes("b22b") || /^\d{13}_/.test(filePath))) {
      effectiveBucket = "event_attachments";
    }
    
    // Direct URL with caching
    const directUrl = getFileUrl(effectiveBucket, filePath);
    
    try {
      // Fetch the file as a blob with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(directUrl, { 
        signal: controller.signal,
        cache: 'force-cache' // Use browser cache when possible
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Create blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create and setup anchor element
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(a);
      a.click();
      
      // Cleanup resources
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
      return { success: true, message: 'Download started' };
    } catch (fetchError) {
      console.error('Fetch error during download:', fetchError);
      
      // Fallback method as last resort
      const a = document.createElement('a');
      a.href = directUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
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
    // Cache control headers for browser
    const cacheExpiry = new Date();
    cacheExpiry.setHours(cacheExpiry.getHours() + 12); // Cache for 12 hours
    
    // Improved bucket determination
    let effectiveBucket = bucketName;
    if (filePath && (filePath.includes("b22b") || /^\d{13}_/.test(filePath))) {
      effectiveBucket = "event_attachments";
    }
    
    const directUrl = getFileUrl(effectiveBucket, filePath);
    
    // Instead of just opening in a new tab, we can preload the file first
    try {
      // Attempt a HEAD request to verify file exists and is accessible
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      await fetch(directUrl, { 
        method: 'HEAD',
        signal: controller.signal,
        cache: 'force-cache',
        headers: {
          'Cache-Control': `public, max-age=${60*60*12}`, // 12 hours
          'Expires': cacheExpiry.toUTCString()
        }
      });
      
      clearTimeout(timeoutId);
    } catch (e) {
      console.warn('File preload check failed, opening directly:', e);
    }
    
    // Open in a new tab with noopener,noreferrer for security
    window.open(directUrl, '_blank', 'noopener,noreferrer');
    
    return { success: true };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, message: 'Failed to open file' };
  }
};
