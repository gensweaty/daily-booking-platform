import { Task, Note, Reminder, CalendarEvent } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { BookingRequest } from "@/types/database";
import { CalendarEventType } from "@/lib/types/calendar";

export const createBookingRequest = async (request: Omit<BookingRequest, "id" | "created_at" | "updated_at" | "status" | "user_id">, file?: File) => {
  const { data: userData } = await supabase.auth.getUser();
  
  console.log("Creating booking request:", request);
  
  try {
    const bookingData = {
      ...request,
      status: 'pending',
      user_id: userData?.user?.id || null
    };
    
    if (request.payment_amount !== undefined && request.payment_amount !== null) {
      const parsedAmount = Number(request.payment_amount);
      bookingData.payment_amount = isNaN(parsedAmount) ? null : parsedAmount;
    } else {
      bookingData.payment_amount = null;
    }
    
    console.log("Final booking data being sent to supabase:", bookingData);
    
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
    
    if (file && data?.id) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${data.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("booking_attachments")
        .upload(filePath, file);
        
      if (uploadError) {
        console.error("Error uploading booking file:", uploadError);
      } else {
        const fileData = {
          booking_id: data.id,
          filename: file.name,
          file_path: filePath,
          content_type: file.type,
          size: file.size
        };
        
        const { error: fileRecordError } = await supabase
          .from("booking_files")
          .insert([fileData]);
          
        if (fileRecordError) {
          console.error("Error creating booking file record:", fileRecordError);
        }
      }
    }
    
    return data;
  } catch (error: any) {
    console.error("Error in createBookingRequest:", error);
    throw new Error(error.message || "Failed to create booking request");
  }
};

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

export const getPublicCalendarEvents = async (businessId: string) => {
  try {
    console.log("[getPublicCalendarEvents] Fetching for business ID:", businessId);
    
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
    
    let events: any[] = [];
    let fetchMethod = "";
    
    try {
      const { data: rpcEvents, error: rpcError } = await supabase
        .rpc('get_public_events_by_user_id', {
          user_id_param: business.user_id
        });
      
      if (rpcError) {
        console.error("Error using RPC function:", rpcError);
        throw rpcError;
      }
      
      events = rpcEvents || [];
      fetchMethod = "rpc";
      console.log(`[getPublicCalendarEvents] Fetched ${events.length} events using RPC function`);
    } catch (rpcError) {
      console.warn("RPC method failed, falling back to direct query:", rpcError);
      
      const { data: directEvents, error: directError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', business.user_id);
        
      if (directError) {
        console.error("Error in fallback query:", directError);
      } else {
        events = directEvents || [];
        fetchMethod = "direct";
        console.log(`[getPublicCalendarEvents] Fetched ${events.length} events using direct query`);
      }
    }
    
    const normalizedEvents: CalendarEventType[] = events.map(event => ({
      ...event,
      deleted_at: event.deleted_at || null
    }));
    
    const activeEvents = normalizedEvents.filter(event => {
      const isDeleted = event.deleted_at !== null;
      if (isDeleted) {
        console.log(`Event ${event.id} is deleted, filtering out`);
      }
      return !isDeleted;
    });
    
    console.log(`[getPublicCalendarEvents] ${fetchMethod} fetched ${events.length} events, filtered to ${activeEvents.length} active events`);
    
    const { data: bookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved');
    
    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
      return { events: activeEvents, bookings: [] };
    }
    
    console.log(`[getPublicCalendarEvents] Fetched ${bookings?.length || 0} approved bookings`);
    
    const uniqueBookings = bookings ? bookings.filter(booking => {
      const hasMatchingEvent = activeEvents.some(
        event => event.booking_request_id === booking.id
      );
      
      if (hasMatchingEvent) {
        console.log(`Booking ${booking.id} already has an event, filtering out duplicate`);
      }
      
      return !hasMatchingEvent;
    }) : [];
    
    console.log(`[getPublicCalendarEvents] Filtered to ${uniqueBookings.length} unique bookings (removed duplicates)`);
    
    return { 
      events: activeEvents, 
      bookings: uniqueBookings
    };
  } catch (error) {
    console.error("Exception in getPublicCalendarEvents:", error);
    return { events: [], bookings: [] };
  }
};
