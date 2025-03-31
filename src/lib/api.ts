import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { Note, Task, Reminder, BusinessProfile, BookingRequest } from "@/types/database";

export const getNotes = async () => {
  const { data, error } = await supabase
    .from("notes")
    .select("*");
  if (error) throw error;
  return data;
};

export const createNote = async (note: Omit<Note, "id" | "created_at">) => {
  const { data, error } = await supabase
    .from("notes")
    .insert([note])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateNote = async (id: string, updates: Partial<Note>) => {
  const { data, error } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteNote = async (id: string) => {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
};

export const getEvents = async (userId?: string) => {
  const query = supabase.from('events').select('*');
  
  if (userId) {
    query.eq('user_id', userId);
  }
  
  const { data, error } = await query.order('start_date', { ascending: true });

  if (error) throw error;
  console.log(`Retrieved ${data?.length || 0} events${userId ? ` for user ${userId}` : ''}`);
  return data;
};

export const getEventsForBusiness = async (businessId: string) => {
  // First get the user_id associated with this business
  const { data: business, error: businessError } = await supabase
    .from("business_profiles")
    .select("user_id")
    .eq("id", businessId)
    .single();
  
  if (businessError) {
    console.error("Error fetching business:", businessError);
    throw businessError;
  }
  
  if (!business?.user_id) {
    console.error("No user_id found for business:", businessId);
    return [];
  }
  
  // Then get all events for this user
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', business.user_id)
    .order('start_date', { ascending: true });

  if (error) {
    console.error("Error fetching events for business:", error);
    throw error;
  }
  
  console.log(`Retrieved ${data?.length || 0} events for business user ${business.user_id}`);
  return data;
};

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
      .eq('user_id', businessData.user_id);

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

export const createEvent = async (event: Partial<CalendarEventType>) => {
  const { data, error } = await supabase
    .from('events')
    .insert([event])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateEvent = async (id: string, updates: Partial<CalendarEventType>) => {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteEvent = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const getTasks = async () => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data;
};

export const createTask = async (task: Omit<Task, "id" | "created_at">) => {
  const { data, error } = await supabase
    .from("tasks")
    .insert([task])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTask = async (id: string, updates: Partial<Task>) => {
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteTask = async (id: string): Promise<void> => {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
};

export const getReminders = async () => {
  const { data, error } = await supabase.from("reminders").select("*");
  if (error) throw error;
  return data;
};

export const createReminder = async (reminder: Omit<Reminder, "id" | "created_at">) => {
  const { data, error } = await supabase
    .from("reminders")
    .insert([reminder])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateReminder = async (id: string, updates: Partial<Reminder>) => {
  const { data, error } = await supabase
    .from("reminders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteReminder = async (id: string): Promise<void> => {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw error;
};

export const getBusinessProfile = async () => {
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .single();
  
  if (error) throw error;
  return data;
};

export const createBusinessProfile = async (profile: Omit<BusinessProfile, "id" | "created_at" | "updated_at" | "user_id">) => {
  const { data, error } = await supabase
    .from("business_profiles")
    .insert([profile])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateBusinessProfile = async (id: string, updates: Partial<BusinessProfile>) => {
  const { data, error } = await supabase
    .from("business_profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getBusinessProfileBySlug = async (slug: string) => {
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("slug", slug)
    .single();
  
  if (error) throw error;
  return data;
};

export const getBookingRequests = async (businessId: string) => {
  const { data, error } = await supabase
    .from("booking_requests")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data;
};

export const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id">) => {
  // Get current user if available
  const { data: userData } = await supabase.auth.getUser();
  
  console.log("Creating booking request:", request);
  
  const { data, error } = await supabase
    .from("booking_requests")
    .insert([{ 
      ...request, 
      status: 'pending',
      user_id: userData?.user?.id || null // Allow null for public bookings
    }])
    .select()
    .single();

  if (error) {
    console.error("Error creating booking request:", error);
    throw error;
  }
  
  console.log("Created booking request:", data);
  return data;
};

export const updateBookingRequest = async (id: string, updates: Partial<BookingRequest>) => {
  const { data, error } = await supabase
    .from("booking_requests")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteBookingRequest = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("booking_requests")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
};
