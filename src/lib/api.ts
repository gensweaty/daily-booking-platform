import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { Note, Task, Reminder } from "@/lib/types";
import { Business, BusinessFormData, EventRequest } from "@/lib/types/business";

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

export const getUserBusiness = async () => {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
};

export const createBusiness = async (formData: BusinessFormData) => {
  // Get the current user to ensure we have their ID
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }
  
  const slug = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  
  const { data, error } = await supabase
    .from("businesses")
    .insert([
      {
        name: formData.name,
        slug,
        description: formData.description,
        contact_phone: formData.contact_phone,
        contact_address: formData.contact_address,
        contact_email: formData.contact_email,
        contact_website: formData.contact_website,
        user_id: user.id, // Explicitly set the user_id to the current authenticated user
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating business:", error);
    throw error;
  }

  if (formData.cover_photo) {
    const fileExt = formData.cover_photo.name.split('.').pop();
    const filePath = `${data.id}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('business_photos')
      .upload(filePath, formData.cover_photo);

    if (uploadError) throw uploadError;
    
    const { error: updateError } = await supabase
      .from("businesses")
      .update({ cover_photo_path: filePath })
      .eq("id", data.id);

    if (updateError) throw updateError;
    
    data.cover_photo_path = filePath;
  }

  return data;
};

export const updateBusiness = async (id: string, formData: BusinessFormData) => {
  const updates: Partial<Business> = {
    name: formData.name,
    description: formData.description,
    contact_phone: formData.contact_phone,
    contact_address: formData.contact_address,
    contact_email: formData.contact_email,
    contact_website: formData.contact_website,
  };

  const { data, error } = await supabase
    .from("businesses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  if (formData.cover_photo) {
    const fileExt = formData.cover_photo.name.split('.').pop();
    const filePath = `${id}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('business_photos')
      .upload(filePath, formData.cover_photo, { upsert: true });

    if (uploadError) throw uploadError;
    
    const { error: updateError } = await supabase
      .from("businesses")
      .update({ cover_photo_path: filePath })
      .eq("id", id);

    if (updateError) throw updateError;
    
    data.cover_photo_path = filePath;
  }

  return data;
};

export const getBusinessBySlug = async (slug: string) => {
  try {
    console.log("Fetching business with slug:", slug);
    // Use anon client for public access - this should not require authentication
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Error fetching business by slug:', error);
      throw error;
    }
    
    if (!data) {
      console.error('Business not found with slug:', slug);
      throw new Error('Business not found');
    }
    
    console.log("Successfully fetched business:", data.name);
    return data;
  } catch (error: any) {
    console.error('Error fetching business by slug:', error);
    throw new Error(error.message || 'Failed to fetch business');
  }
};

export const getEventRequests = async (businessId: string) => {
  const { data, error } = await supabase
    .from("event_requests")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const createEventRequest = async (request: Omit<EventRequest, "id" | "created_at" | "updated_at" | "status">) => {
  const { data, error } = await supabase
    .from("event_requests")
    .insert([{
      ...request,
      status: 'pending'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const approveEventRequest = async (id: string) => {
  const { data: request, error: fetchError } = await supabase
    .from("event_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  const { error: createError } = await supabase
    .from("events")
    .insert([{
      title: request.title,
      user_surname: request.user_surname,
      user_number: request.user_number,
      social_network_link: request.social_network_link,
      event_notes: request.event_notes,
      start_date: request.start_date,
      end_date: request.end_date,
      type: request.type || 'private_party',
      payment_status: request.payment_status,
      payment_amount: request.payment_amount
    }]);

  if (createError) throw createError;

  const { data, error } = await supabase
    .from("event_requests")
    .update({ status: 'approved' })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
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
