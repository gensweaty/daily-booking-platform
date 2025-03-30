import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { Note, Task, Reminder, Business, EventRequest } from "@/lib/types";

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
  console.log(`API: Retrieved ${data?.length || 0} events`);
  return data;
};

export const getAllBusinessEvents = async (businessId: string) => {
  if (!businessId) {
    throw new Error("Business ID is required to fetch events");
  }
  
  console.log("API: Fetching all business events for:", businessId);
  
  // First, get direct events from the events table
  const { data: directEvents, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('business_id', businessId)
    .order('start_date', { ascending: true });

  if (eventsError) {
    console.error("API: Error fetching events:", eventsError);
    throw eventsError;
  }
  
  // Then, get approved event requests
  const { data: approvedRequests, error: requestsError } = await supabase
    .from('event_requests')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'approved')
    .order('start_date', { ascending: true });
    
  if (requestsError) {
    console.error("API: Error fetching approved requests:", requestsError);
    throw requestsError;
  }
  
  // Convert approved requests to event format
  const requestEvents = (approvedRequests || []).map(req => ({
    id: req.id,
    title: req.title,
    start_date: req.start_date,
    end_date: req.end_date,
    created_at: req.created_at,
    updated_at: req.updated_at || req.created_at,
    user_surname: req.user_surname,
    user_number: req.user_number,
    social_network_link: req.social_network_link,
    event_notes: req.event_notes,
    type: req.type || 'standard',
    payment_status: req.payment_status,
    payment_amount: req.payment_amount,
    business_id: req.business_id
  }));
  
  // Combine both arrays
  const allEvents = [
    ...(directEvents || []),
    ...requestEvents
  ];
  
  console.log(`API: Retrieved ${allEvents.length} total events for business ${businessId}`);
  console.log(`API: ${directEvents?.length || 0} direct events, ${approvedRequests?.length || 0} approved requests`);
  
  return allEvents;
};

export const createEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
  console.log("API createEvent called with:", JSON.stringify(event));
  
  // Try to get user's business ID if not provided
  if (!event.business_id) {
    console.log("API: No business_id provided, trying to find user's business");
    const { data: userBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .maybeSingle();
      
    if (userBusiness?.id) {
      event.business_id = userBusiness.id;
      console.log("API: Found user's business ID:", userBusiness.id);
    } else {
      console.log("API: No business found for user");
    }
  }

  const { data, error } = await supabase
    .from('events')
    .insert([event])
    .select()
    .single();

  if (error) {
    console.error("API: Error creating event:", error);
    throw error;
  }
  
  console.log("API: Successfully created event with ID:", data.id);
  return data;
};

export const updateEvent = async (event: Partial<CalendarEventType>): Promise<CalendarEventType> => {
  console.log("API updateEvent called with:", JSON.stringify(event));
  const id = event.id;
  if (!id) throw new Error("Event ID is required");
  
  // Remove ID from the updates object
  const { id: _, ...updates } = event;
  
  // Try to get user's business ID if not provided
  if (!updates.business_id) {
    console.log("API: No business_id provided for update, checking existing event");
    // First try to get the event's existing business_id
    const { data: existingEvent } = await supabase
      .from('events')
      .select('business_id')
      .eq('id', id)
      .single();
      
    if (existingEvent?.business_id) {
      updates.business_id = existingEvent.business_id;
      console.log("API: Using existing business_id:", existingEvent.business_id);
    } else {
      console.log("API: No existing business_id, trying to find user's business");
      // Try to get user's business
      const { data: userBusiness } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();
        
      if (userBusiness?.id) {
        updates.business_id = userBusiness.id;
        console.log("API: Found user's business ID for update:", userBusiness.id);
      } else {
        console.log("API: No business found for user during update");
      }
    }
  }

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("API: Error updating event:", error);
    throw error;
  }
  
  console.log("API: Successfully updated event with ID:", data.id);
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

export const getBusiness = async () => {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

export const createBusiness = async (business: Omit<Business, "id" | "created_at" | "user_id" | "slug">) => {
  // Get the current user ID
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("User not authenticated");
  
  const slug = business.name
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '-');
  
  const { data, error } = await supabase
    .from("businesses")
    .insert([{ 
      ...business, 
      slug,
      user_id: user.id
    }])
    .select()
    .single();

  if (error) {
    console.error("Business creation error:", error);
    throw error;
  }
  
  return data;
};

export const updateBusiness = async (id: string, updates: Partial<Business>) => {
  if (updates.name) {
    updates.slug = updates.name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-');
  }
  
  const { data, error } = await supabase
    .from("businesses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteBusiness = async (id: string) => {
  const { error } = await supabase.from("businesses").delete().eq("id", id);
  if (error) throw error;
};

export const getBusinessBySlug = async (slug: string) => {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

export const uploadBusinessCoverPhoto = async (file: File, businessId: string) => {
  const fileExt = file.name.split('.').pop();
  const filePath = `business_covers/${businessId}/${crypto.randomUUID()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('business_covers')
    .upload(filePath, file);

  if (uploadError) throw uploadError;
  
  const { data, error: updateError } = await supabase
    .from("businesses")
    .update({ cover_photo_path: filePath })
    .eq("id", businessId)
    .select()
    .single();
    
  if (updateError) throw updateError;
  return data;
};

export const getEventRequests = async (businessId: string) => {
  const { data, error } = await supabase
    .from("event_requests")
    .select("*")
    .eq("business_id", businessId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const createEventRequest = async (eventRequest: Omit<EventRequest, "id" | "created_at" | "status">) => {
  const { data, error } = await supabase
    .from("event_requests")
    .insert([{ ...eventRequest, status: 'pending' }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const approveEventRequest = async (id: string) => {
  const { data: eventRequest, error: fetchError } = await supabase
    .from("event_requests")
    .select("*")
    .eq("id", id)
    .single();
  
  if (fetchError) throw fetchError;
  
  const { error: createError } = await supabase
    .from("events")
    .insert([{
      title: eventRequest.title,
      user_surname: eventRequest.user_surname,
      user_number: eventRequest.user_number,
      social_network_link: eventRequest.social_network_link,
      event_notes: eventRequest.event_notes,
      start_date: eventRequest.start_date,
      end_date: eventRequest.end_date,
      type: eventRequest.type,
      payment_status: eventRequest.payment_status,
      payment_amount: eventRequest.payment_amount,
      user_id: (await supabase.auth.getUser()).data.user?.id
    }]);
  
  if (createError) throw createError;
  
  const { data, error: updateError } = await supabase
    .from("event_requests")
    .update({ status: 'approved' })
    .eq("id", id)
    .select()
    .single();
  
  if (updateError) throw updateError;
  return data;
};

export const rejectEventRequest = async (id: string) => {
  const { data, error } = await supabase
    .from("event_requests")
    .update({ status: 'rejected' })
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
