import { supabase } from '@/lib/supabase';
import { CalendarEventType } from '@/lib/types/calendar';

export const fetchEvents = async (userId: string): Promise<CalendarEventType[]> => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      id,
      title,
      start_date,
      end_date,
      user_id,
      user_surname,
      user_number,
      social_network_link,
      event_notes,
      event_name,
      payment_status,
      payment_amount,
      type,
      is_recurring,
      repeat_pattern,
      repeat_until,
      parent_event_id,
      language,
      reminder_at,
      created_at,
      updated_at,
      deleted_at
    `)
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching events:', error);
    throw error;
  }

  return (data || []).map(event => ({
    id: event.id,
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    user_id: event.user_id,
    user_surname: event.user_surname,
    user_number: event.user_number,
    social_network_link: event.social_network_link,
    event_notes: event.event_notes,
    event_name: event.event_name,
    payment_status: event.payment_status,
    payment_amount: event.payment_amount,
    type: event.type,
    is_recurring: event.is_recurring,
    repeat_pattern: event.repeat_pattern,
    repeat_until: event.repeat_until,
    parent_event_id: event.parent_event_id,
    language: event.language,
    reminder_at: event.reminder_at,
    email_reminder_enabled: false, // Default value since column doesn't exist
    created_at: event.created_at,
    updated_at: event.updated_at || event.created_at,
    deleted_at: event.deleted_at,
  }));
};

export const createEvent = async (event: Omit<CalendarEventType, 'id'>): Promise<CalendarEventType> => {
  const { data, error } = await supabase
    .from('events')
    .insert([event])
    .select()
    .single();

  if (error) {
    console.error('Error creating event:', error);
    throw error;
  }

  return data as CalendarEventType;
};

export const updateEvent = async (event: CalendarEventType): Promise<CalendarEventType> => {
  const { data, error } = await supabase
    .from('events')
    .update(event)
    .eq('id', event.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating event:', error);
    throw error;
  }

  return data as CalendarEventType;
};

export const deleteEvent = async (id: string): Promise<{ success: boolean }> => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting event:', error);
    throw error;
  }

  return { success: true };
};

export const deleteRecurringEvent = async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }): Promise<{ success: boolean; }> => {
  if (deleteChoice === "series") {
    // Delete the series
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('parent_event_id', id);

    if (error) {
      console.error('Error deleting event series:', error);
      throw error;
    }

    // Also delete the parent event
    const { error: parentError } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (parentError) {
      console.error('Error deleting parent event:', parentError);
      throw parentError;
    }

    return { success: true };
  } else {
    // Just delete the single event
    return deleteEvent(id);
  }
};
