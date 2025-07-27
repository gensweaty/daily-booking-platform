import { Task, Note, Reminder, CalendarEvent } from "@/lib/types";
import { supabase, normalizeFilePath } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";

// Rate limiting storage in localStorage
const RATE_LIMIT_KEY = 'booking_request_last_time';
const RATE_LIMIT_COOLDOWN = 120; // 2 minutes in seconds

// Helper function to get file URL with consistent bucket handling
export const getFileUrl = (bucketName: string, filePath: string) => {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const normalizedPath = normalizeFilePath(filePath);
  
  // Always use event_attachments bucket for consistent file access
  return `${baseUrl}/storage/v1/object/public/event_attachments/${normalizedPath}`;
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

// Enhanced function to get business profile with better fallbacks
const getBusinessProfileWithFallbacks = async (): Promise<{
  business_name: string;
  contact_email: string | null;
  contact_address: string | null;
}> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      console.log("📋 No authenticated user found, using system defaults");
      return {
        business_name: "SmartBookly",
        contact_email: null,
        contact_address: null
      };
    }

    console.log("📋 Fetching business profile for user:", userData.user.id);
    
    const { data: profile, error } = await supabase
      .from("business_profiles")
      .select("business_name, contact_email, contact_address")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      console.warn("📋 Error fetching business profile:", error);
      return {
        business_name: "SmartBookly",
        contact_email: null,
        contact_address: null
      };
    }

    if (!profile) {
      console.log("📋 No business profile found, using defaults");
      return {
        business_name: "SmartBookly",
        contact_email: null,
        contact_address: null
      };
    }

    console.log("📋 Business profile found:", profile);
    return {
      business_name: profile.business_name || "SmartBookly",
      contact_email: profile.contact_email,
      contact_address: profile.contact_address
    };
  } catch (error) {
    console.error("📋 Error in getBusinessProfileWithFallbacks:", error);
    return {
      business_name: "SmartBookly",
      contact_email: null,
      contact_address: null
    };
  }
};

// Helper function to get authenticated session and token
const getAuthenticatedSession = async () => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    if (!accessToken) {
      console.error("No access token available for authenticated request");
      return { success: false, error: "Authentication error", token: null };
    }
    
    return { success: true, token: accessToken, error: null };
  } catch (error) {
    console.error("Error getting session:", error);
    return { success: false, error: "Failed to get authentication session", token: null };
  }
};

// Consolidated email sending function using direct fetch with authentication
export const sendBookingConfirmationEmail = async (
  recipientEmail: string, 
  fullName: string = '', 
  businessName: string = '',
  startDate: string = new Date().toISOString(),
  endDate: string = new Date().toISOString(),
  paymentStatus?: string | null,
  paymentAmount?: number | null,
  businessAddress?: string,
  eventId?: string,
  language?: string,
  eventNotes?: string
) => {
  try {
    console.log("=== ATTEMPTING TO SEND BOOKING CONFIRMATION ===");
    console.log(`🔔 Sending booking confirmation email to ${recipientEmail}`);
    
    if (!recipientEmail || !recipientEmail.includes('@')) {
      console.log("NOT SENDING EMAIL: Invalid email format or missing email:", recipientEmail);
      return { success: false, error: "Invalid email format" };
    }
    
    // Get authenticated session
    const authResult = await getAuthenticatedSession();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }
    
    // Get business profile with fallbacks - NEVER block email sending
    const businessProfile = await getBusinessProfileWithFallbacks();
    
    // Use provided businessName or fallback to profile business name
    const effectiveBusinessName = businessName || businessProfile.business_name || "SmartBookly";
    const effectiveBusinessAddress = businessAddress || businessProfile.contact_address || "";
    
    console.log("📋 Using business data:", {
      businessName: effectiveBusinessName,
      businessAddress: effectiveBusinessAddress ? "provided" : "empty"
    });
    
    // Create the request payload
    const payload = {
      recipientEmail: recipientEmail.trim(),
      fullName: fullName || "",
      businessName: effectiveBusinessName,
      startDate,
      endDate,
      paymentStatus,
      paymentAmount,
      businessAddress: effectiveBusinessAddress,
      eventId,
      source: 'booking-approval', // Use booking-approval for booking confirmations
      language: language || 'en',
      eventNotes
    };
    
    console.log("📧 Email request payload:", {
      ...payload,
      recipientEmail: recipientEmail.trim().substring(0, 3) + '***' // Mask email for privacy
    });
    
    // Use direct fetch with authentication headers (matching working booking approval pattern)
    console.log("🌐 Calling Edge Function: send-booking-approval-email");
    
    const response = await fetch(
      "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authResult.token}`
        },
        body: JSON.stringify(payload),
      }
    );
    
    // Read the response as text first
    const responseText = await response.text();
    
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error("Failed to parse response JSON:", e);
      if (!response.ok) {
        return { success: false, error: `Invalid response (status ${response.status})` };
      }
      return { success: true, message: "Email notification processed (response parsing error)" };
    }
    
    if (!response.ok) {
      console.error("Failed to send booking confirmation email:", data);
      return { success: false, error: data.error || data.details || "Failed to send email" };
    } else {
      console.log("✅ Email sent successfully:", data);
      return { success: true, data };
    }
    
  } catch (error) {
    console.error("❌ Error in sendBookingConfirmationEmail:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

// New function specifically for event creation emails using direct fetch with authentication
export const sendEventCreationEmail = async (
  recipientEmail: string, 
  fullName: string = '', 
  businessName: string = '',
  startDate: string = new Date().toISOString(),
  endDate: string = new Date().toISOString(),
  paymentStatus?: string | null,
  paymentAmount?: number | null,
  businessAddress?: string,
  eventId?: string,
  language?: string,
  eventNotes?: string
) => {
  try {
    console.log("=== ATTEMPTING TO SEND EVENT CREATION EMAIL ===");
    console.log(`🔔 Sending event creation email to ${recipientEmail}`);
    
    if (!recipientEmail || !recipientEmail.includes('@')) {
      console.log("NOT SENDING EMAIL: Invalid email format or missing email:", recipientEmail);
      return { success: false, error: "Invalid email format" };
    }
    
    // Get authenticated session
    const authResult = await getAuthenticatedSession();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }
    
    // Get business profile with fallbacks - NEVER block email sending
    const businessProfile = await getBusinessProfileWithFallbacks();
    
    // Use provided businessName or fallback to profile business name
    const effectiveBusinessName = businessName || businessProfile.business_name || "SmartBookly";
    const effectiveBusinessAddress = businessAddress || businessProfile.contact_address || "";
    
    console.log("📋 Using business data:", {
      businessName: effectiveBusinessName,
      businessAddress: effectiveBusinessAddress ? "provided" : "empty"
    });
    
    // Create the request payload
    const payload = {
      recipientEmail: recipientEmail.trim(),
      fullName: fullName || "",
      businessName: effectiveBusinessName,
      startDate,
      endDate,
      paymentStatus,
      paymentAmount,
      businessAddress: effectiveBusinessAddress,
      eventId,
      source: 'event-creation', // Use event-creation for event creation emails
      language: language || 'en',
      eventNotes
    };
    
    console.log("📧 Email request payload:", {
      ...payload,
      recipientEmail: recipientEmail.trim().substring(0, 3) + '***' // Mask email for privacy
    });
    
    // Use direct fetch with authentication headers (matching working booking approval pattern)
    console.log("🌐 Calling Edge Function: send-booking-approval-email");
    
    const response = await fetch(
      "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-approval-email",
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authResult.token}`
        },
        body: JSON.stringify(payload),
      }
    );
    
    // Read the response as text first
    const responseText = await response.text();
    
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error("Failed to parse response JSON:", e);
      if (!response.ok) {
        return { success: false, error: `Invalid response (status ${response.status})` };
      }
      return { success: true, message: "Email notification processed (response parsing error)" };
    }
    
    if (!response.ok) {
      console.error("Failed to send event creation email:", data);
      return { success: false, error: data.error || data.details || "Failed to send email" };
    } else {
      console.log("✅ Event creation email sent successfully:", data);
      return { success: true, data };
    }
    
  } catch (error) {
    console.error("❌ Error in sendEventCreationEmail:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

// Helper function to send emails to multiple recipients using direct fetch
export const sendBookingConfirmationToMultipleRecipients = async (
  recipients: Array<{
    email: string;
    name: string;
  }>,
  businessName: string,
  startDate: string,
  endDate: string,
  paymentStatus?: string,
  paymentAmount?: number,
  businessAddress?: string,
  eventId?: string,
  language?: string,
  eventNotes?: string
) => {
  console.log("=== ATTEMPTING TO SEND MULTIPLE BOOKING CONFIRMATIONS ===");
  console.log(`📧 Sending booking confirmations to ${recipients.length} recipients`);
  
  if (recipients.length === 0) {
    console.log("NOT SENDING EMAIL: No valid email addresses found for sending notifications");
    return {
      total: 0,
      successful: 0,
      failed: 0,
      results: []
    };
  }
  
  const results = await Promise.allSettled(
    recipients.map(recipient => 
      sendBookingConfirmationEmail(
        recipient.email,
        recipient.name,
        businessName,
        startDate,
        endDate,
        paymentStatus,
        paymentAmount,
        businessAddress,
        eventId,
        language,
        eventNotes
      )
    )
  );
  
  const successful = results.filter(result => 
    result.status === 'fulfilled' && result.value.success
  ).length;
  
  const failed = results.length - successful;
  
  console.log(`📊 Email sending results: ${successful} successful, ${failed} failed`);
  
  return {
    total: recipients.length,
    successful,
    failed,
    results
  };
};

// Legacy function name for backward compatibility
export const testEmailSending = sendBookingConfirmationEmail;

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
      .eq("archived", false)
      .order("position", { ascending: true });
      
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    throw new Error(error.message || "Failed to fetch tasks");
  }
};

export const getArchivedTasks = async (): Promise<Task[]> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData?.user) {
      throw new Error("User not authenticated");
    }
    
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("archived", true)
      .order("archived_at", { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error("Error fetching archived tasks:", error);
    throw new Error(error.message || "Failed to fetch archived tasks");
  }
};

export const archiveTask = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from("tasks")
      .update({ 
        archived: true, 
        archived_at: new Date().toISOString() 
      })
      .eq("id", id);
      
    if (error) throw error;
  } catch (error: any) {
    console.error("Error archiving task:", error);
    throw new Error(error.message || "Failed to archive task");
  }
};

export const restoreTask = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from("tasks")
      .update({ 
        archived: false, 
        archived_at: null 
      })
      .eq("id", id);
      
    if (error) throw error;
  } catch (error: any) {
    console.error("Error restoring task:", error);
    throw new Error(error.message || "Failed to restore task");
  }
};

export const createTask = async (task: {
  title: string;
  description?: string;
  status: 'todo' | 'inprogress' | 'done';
  user_id: string;
  position?: number;
  deadline_at?: string | null;
  reminder_at?: string | null;
  send_email_reminder?: boolean;
  reminder_sent?: boolean;
}): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([task])
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }

  return data;
};

export const updateTask = async (id: string, updates: {
  title?: string;
  description?: string;
  status?: 'todo' | 'inprogress' | 'done';
  position?: number;
  deadline_at?: string | null;
  reminder_at?: string | null;
  send_email_reminder?: boolean;
  reminder_sent?: boolean;
}): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    throw error;
  }

  return data;
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
    
    // Always use event_attachments bucket for consistent file access
    const effectiveBucket = "event_attachments";
    console.log(`Using effective bucket: ${effectiveBucket}`);
    
    // Direct URL for download
    const directUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${effectiveBucket}/${normalizeFilePath(filePath)}`;
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
    // Always use event_attachments bucket
    const effectiveBucket = "event_attachments";
    
    const directUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${effectiveBucket}/${normalizeFilePath(filePath)}`;
    
    console.log('Opening file with direct URL:', directUrl);
    
    // Open in a new tab to prevent navigation away from the current page
    window.open(directUrl, '_blank', 'noopener,noreferrer');
    
    return { success: true };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, message: 'Failed to open file' };
  }
};
