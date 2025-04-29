import { Task, Note, Reminder, CalendarEvent } from "@/lib/types";
import { supabase, normalizeFilePath } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";
import { ensureAllRequiredBuckets } from "@/integrations/supabase/checkStorage";

// Ensure all required buckets exist when this file is imported
ensureAllRequiredBuckets().then(success => {
  if (success) {
    console.log("Storage buckets verification completed successfully");
  } else {
    console.warn("Storage buckets verification failed, some features might not work properly");
  }
}).catch(error => {
  console.error("Error during storage bucket verification:", error);
});

// Rate limiting storage in localStorage
const RATE_LIMIT_KEY = 'booking_request_last_time';
const RATE_LIMIT_COOLDOWN = 120; // 2 minutes in seconds

// Helper function to get file URL with consistent bucket handling
export const getFileUrl = (bucketName: string, filePath: string) => {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mrueqpffzauvdxmuwhfa.supabase.co";
  const normalizedPath = normalizeFilePath(filePath);
  
  // Always use event_attachments bucket for consistent file access
  return `${baseUrl}/storage/v1/object/public/${bucketName}/${normalizedPath}`;
};

// Check if user is rate limited for booking requests
export const checkRateLimitStatus = async (): Promise<{ isLimited: boolean, remainingTime: number }> => {
  try {
    // Get last request timestamp from localStorage
    const lastRequestTime = localStorage.getItem(RATE_LIMIT_KEY);
    
    if (!lastRequestTime) {
      return { isLimited: false, remainingTime: 0 };
    }
    
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const timeSinceLastRequest = now - parseInt(lastRequestTime, 10);
    
    if (timeSinceLastRequest < RATE_LIMIT_COOLDOWN) {
      // User is rate limited
      const remainingTime = RATE_LIMIT_COOLDOWN - timeSinceLastRequest;
      return { isLimited: true, remainingTime };
    }
    
    return { isLimited: false, remainingTime: 0 };
  } catch (error) {
    console.error("Error checking rate limit:", error);
    return { isLimited: false, remainingTime: 0 }; // Default to not limited in case of error
  }
};

export const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id">) => {
  // Ensure buckets exist before attempting to use them
  await ensureAllRequiredBuckets();

  // Get current user if available
  const { data: userData } = await supabase.auth.getUser();
  
  console.log("Creating booking request:", request);
  
  try {
    // Check rate limit before creating booking
    const { isLimited } = await checkRateLimitStatus();
    
    if (isLimited) {
      throw new Error("Rate limit reached. Please wait before submitting another booking request.");
    }
    
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
    
    // Store current timestamp in localStorage for rate limiting
    localStorage.setItem(RATE_LIMIT_KEY, Math.floor(Date.now() / 1000).toString());
    
    console.log("Created booking request:", data);
    return data;
  } catch (error: any) {
    console.error("Error in createBookingRequest:", error);
    throw new Error(error.message || "Failed to create booking request");
  }
};

// Test function to verify email sending functionality
export const testEmailSending = async (recipientEmail: string): Promise<any> => {
  try {
    console.log("Testing email sending to:", recipientEmail);
    
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    if (!accessToken) {
      console.error("No access token available for authenticated request");
      throw new Error("Authentication error");
    }
    
    const testData = {
      recipientEmail: recipientEmail.trim(),
      fullName: "Test User",
      businessName: "Test Business",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
    };
    
    console.log("Sending test email with data:", testData);
    
    const response = await fetch(
      "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(testData),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error sending test email:", errorText);
      try {
        return JSON.parse(errorText);
      } catch (e) {
        return { error: errorText };
      }
    }
    
    const result = await response.json();
    console.log("Test email result:", result);
    return result;
  } catch (error: any) {
    console.error("Exception in testEmailSending:", error);
    return { 
      error: true, 
      message: error.message || "Unknown error",
      stack: error.stack
    };
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
    let userId = null;
    
    // Get the business user ID first
    const { data: businessData, error: businessError } = await supabase
      .from('business_profiles')
      .select('user_id')
      .eq('id', businessId)
      .single();
    
    if (businessError) {
      console.error('Error fetching business user ID:', businessError);
      return { events: [], bookings: [] };
    }
    
    userId = businessData?.user_id;
    
    if (!userId) {
      console.error('No user ID found for business:', businessId);
      return { events: [], bookings: [] };
    }
    
    // Get events using the RPC function that bypasses RLS
    const { data: events, error: eventsError } = await supabase
      .rpc('get_public_events_by_user_id', { user_id_param: userId });
    
    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return { events: [], bookings: [] };
    }
    
    // Get all approved booking requests for this business
    const { data: bookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .is('deleted_at', null); // Add check for soft-deleted bookings
      
    if (bookingsError) {
      console.error('Error fetching approved bookings:', bookingsError);
      return { events: events || [], bookings: [] };
    }
    
    return {
      events: events || [],
      bookings: bookings || [],
    };
  } catch (error) {
    console.error('Error in getPublicCalendarEvents:', error);
    return { events: [], bookings: [] };
  }
};

// Enhanced file handling functions with consistent bucket handling
export const downloadFile = async (bucketName: string, filePath: string, fileName: string) => {
  try {
    console.log(`Attempting to download file: ${fileName}, path: ${filePath}`);
    
    // Ensure bucket exists before attempting download
    ensureAllRequiredBuckets();
    
    // Always use specified bucket for consistent file access
    const effectiveBucket = bucketName || "event_attachments";
    console.log(`Using effective bucket: ${effectiveBucket}`);
    
    // Direct URL for download
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mrueqpffzauvdxmuwhfa.supabase.co";
    const directUrl = `${baseUrl}/storage/v1/object/public/${effectiveBucket}/${normalizeFilePath(filePath)}`;
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
      
      // Add to DOM, click, and clean up
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
    // Ensure bucket exists before attempting to open
    ensureAllRequiredBuckets();
    
    // Use specified bucket or default to event_attachments
    const effectiveBucket = bucketName || "event_attachments";
    
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mrueqpffzauvdxmuwhfa.supabase.co";
    const directUrl = `${baseUrl}/storage/v1/object/public/${effectiveBucket}/${normalizeFilePath(filePath)}`;
    
    console.log('Opening file with direct URL:', directUrl);
    
    // Open in a new tab to prevent navigation away from the current page
    window.open(directUrl, '_blank', 'noopener,noreferrer');
    
    return { success: true };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, message: 'Failed to open file' };
  }
};
