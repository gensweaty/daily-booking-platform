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

export const getBusiness = async () => {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

export const createBusiness = async (business: Omit<Business, "id" | "created_at" | "user_id" | "slug">) => {
  const slug = business.name
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '-');
  
  const { data, error } = await supabase
    .from("businesses")
    .insert([{ ...business, slug }])
    .select()
    .single();

  if (error) throw error;
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
