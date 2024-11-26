import { supabase } from "@/lib/supabase";
import { CalendarEventType } from "@/lib/types/calendar";
import { Note, Task, Reminder } from "@/lib/types";

export const getNotes = async () => {
  const { data, error } = await supabase.from<Note>("notes").select("*");
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

export const getTasks = async () => {
  const { data, error } = await supabase.from<Task>("tasks").select("*");
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

export const deleteEvent = async (id: string) => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);

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
