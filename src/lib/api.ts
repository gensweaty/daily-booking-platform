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

export const getEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true });

  if (error) throw error;
  return data;
};

export const createEvent = async (event: Partial<CalendarEventType>) => {
  console.log("Creating event with data:", event);
  const { data, error } = await supabase
    .from('events')
    .insert([event])
    .select()
    .single();

  if (error) {
    console.error("Error creating event:", error);
    throw error;
  }
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
  
  if (error) {
    console.error("Error fetching booking requests:", error);
    throw error;
  }
  return data;
};

export const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status">) => {
  try {
    console.log("Creating booking request:", request);
    
    // Validate required fields
    if (!request.business_id) throw new Error("Business ID is required");
    if (!request.requester_name) throw new Error("Name is required");
    if (!request.requester_email) throw new Error("Email is required");
    if (!request.title) throw new Error("Title is required");
    if (!request.start_date) throw new Error("Start date is required");
    if (!request.end_date) throw new Error("End date is required");
    
    const { data, error } = await supabase
      .from("booking_requests")
      .insert([{ 
        ...request, 
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      console.error("Error creating booking request:", error);
      throw new Error(`Request failed: ${error.message || "Unknown error"}`);
    }
    
    console.log("Booking request created successfully:", data);
    return data;
  } catch (error: any) {
    console.error("Exception in createBookingRequest:", error);
    throw error;
  }
};

export const updateBookingRequest = async (id: string, updates: Partial<BookingRequest>) => {
  console.log(`Updating booking request ${id} with:`, updates);
  
  const { data, error } = await supabase
    .from("booking_requests")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating booking request:", error);
    throw error;
  }
  
  console.log("Booking request updated:", data);
  
  // If this is an approval and the status was changed to 'approved',
  // automatically create an event from this booking request
  if (updates.status === 'approved') {
    try {
      // Fetch the full booking request to get all needed data
      const { data: bookingData, error: fetchError } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("id", id)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Create a corresponding event in the calendar
      const eventData = {
        title: bookingData.title,
        event_notes: bookingData.description || '',
        start_date: bookingData.start_date,
        end_date: bookingData.end_date,
        type: 'booking_request',
        user_surname: bookingData.requester_name,
        user_number: bookingData.requester_phone || '',
        business_id: bookingData.business_id,
        booking_request_id: bookingData.id
      };
      
      console.log("Creating event from approved booking request:", eventData);
      
      const { data: eventResult, error: eventError } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();
        
      if (eventError) {
        console.error("Error creating event from booking request:", eventError);
      } else {
        console.log("Event created successfully:", eventResult);
      }
    } catch (err) {
      console.error("Error handling booking approval:", err);
      // We don't throw here to avoid failing the booking update
    }
  }
  
  return data;
};

export const deleteBookingRequest = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("booking_requests")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
};
