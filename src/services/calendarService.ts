
import { supabase } from '@/lib/supabase';
import { CalendarEventType } from '@/lib/types/calendar';

// Add cache management
let cacheInvalidationSignal = 0;

export const clearCalendarCache = () => {
  cacheInvalidationSignal++;
  console.log('[calendarService] Cache cleared, signal:', cacheInvalidationSignal);
  
  // Broadcast cache invalidation across components
  window.dispatchEvent(new CustomEvent('calendar-cache-invalidated', {
    detail: { signal: cacheInvalidationSignal, timestamp: Date.now() }
  }));
  
  // Cross-tab synchronization
  localStorage.setItem('calendar_invalidation_signal', cacheInvalidationSignal.toString());
};

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
    email_reminder_enabled: false, // Default value since column doesn't exist in database
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

// Enhanced unified calendar service functions
export const getUnifiedCalendarEvents = async (businessId?: string, userId?: string) => {
  const events: CalendarEventType[] = [];
  const bookings: CalendarEventType[] = [];
  
  if (userId) {
    try {
      const eventsData = await fetchEvents(userId);
      events.push(...eventsData);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }
  
  if (businessId) {
    try {
      const { data: bookingData, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved');
      
      if (error) throw error;
      
      bookings.push(...(bookingData || []).map(booking => ({
        id: booking.id,
        title: booking.requester_name || booking.title || 'Booking',
        start_date: booking.start_date,
        end_date: booking.end_date,
        user_surname: booking.requester_name,
        user_number: booking.requester_phone,
        social_network_link: booking.requester_email,
        event_notes: booking.description,
        payment_status: booking.payment_status,
        payment_amount: booking.payment_amount,
        type: 'booking_request',
        created_at: booking.created_at,
        updated_at: booking.updated_at,
        reminder_at: undefined,
        email_reminder_enabled: false,
      } as CalendarEventType)));
    } catch (error) {
      console.error('Error fetching approved bookings:', error);
    }
  }
  
  return { events, bookings };
};

export const deleteCalendarEvent = async (id: string, eventType: 'event' | 'booking_request', userId: string) => {
  if (eventType === 'booking_request') {
    const { error } = await supabase
      .from('booking_requests')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
  }
  
  clearCalendarCache();
  
  // Signal cross-tab deletion
  localStorage.setItem('calendar_event_deleted', JSON.stringify({ id, timestamp: Date.now() }));
  
  return { success: true };
};
