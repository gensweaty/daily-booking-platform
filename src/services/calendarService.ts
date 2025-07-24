import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from '@/lib/types/calendar';

export interface CalendarEventsResponse {
  events: CalendarEventType[];
  bookings: CalendarEventType[];
}

export const clearCalendarCache = (): void => {
  try {
    const keysToClear = Object.keys(sessionStorage).filter(key =>
      key.startsWith('calendar_events_') ||
      key.startsWith('business_user_id_') ||
      key.startsWith('unified_calendar_')
    );
    keysToClear.forEach(key => sessionStorage.removeItem(key));
    
    localStorage.setItem('calendar_invalidation_signal', Date.now().toString());
    setTimeout(() => localStorage.removeItem('calendar_invalidation_signal'), 1000);

    console.log('[CalendarService] Cache cleared');
  } catch (error) {
    console.warn('[CalendarService] Error clearing cache:', error);
  }
};

export const getUnifiedCalendarEvents = async (
  businessId?: string, 
  businessUserId?: string
): Promise<CalendarEventsResponse> => {
  if (!businessUserId) {
    console.log('[CalendarService] No user ID available for fetching events.');
    return { events: [], bookings: [] };
  }

  // 1. Fetch standard events created by the user
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', businessUserId)
    .is('deleted_at', null);

  if (eventsError) {
    console.error('[CalendarService] Error fetching standard events:', eventsError);
    throw eventsError;
  }

  // 2. Fetch approved booking requests which are also displayed on the calendar
  let approvedBookings: any[] = [];
  if (businessId) {
    const { data: bookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved') // The key to finding "green events"
      .is('deleted_at', null);

    if (bookingsError) {
      console.error('[CalendarService] Error fetching approved bookings:', bookingsError);
    } else {
      approvedBookings = bookings || [];
    }
  }

  // 3. Format both lists into a consistent calendar event type
  const formattedEvents: CalendarEventType[] = (events || []).map(event => ({
    ...event,
    type: 'event',
  }));

  const formattedBookings: CalendarEventType[] = approvedBookings.map(booking => ({
    ...booking,
    start_date: booking.start_date,
    end_date: booking.end_date,
    user_surname: booking.requester_name,
    user_number: booking.requester_phone,
    social_network_link: booking.requester_email,
    event_notes: booking.description,
    type: 'booking_request', // This type is crucial for the delete logic
  }));
  
  console.log(`[CalendarService] Loaded ${formattedEvents.length} standard events and ${formattedBookings.length} approved bookings.`);

  return {
    events: formattedEvents,
    bookings: formattedBookings
  };
};

export const deleteCalendarEvent = async (
  eventId: string,
  deleteChoice?: "this" | "series"
): Promise<{ success: boolean }> => {
  console.log(`[CalendarService] Attempting to delete ID: ${eventId} with choice: ${deleteChoice}`);

  // First, check if the ID belongs to a booking request. This is the most reliable way to identify "green events".
  const { data: bookingCheck, error: bookingCheckError } = await supabase
    .from('booking_requests')
    .select('id')
    .eq('id', eventId)
    .single();

  if (bookingCheck) {
    // This IS an approved booking. Soft delete it and any linked event.
    console.log(`[CalendarService] Confirmed ID ${eventId} is a booking_request. Soft deleting.`);
    
    // Soft-delete the booking_request itself
    const { error: bookingDeleteError } = await supabase
      .from('booking_requests')
      .update({ deleted_at: new Date().toISOString(), status: 'rejected' })
      .eq('id', eventId);

    if (bookingDeleteError) throw new Error(`Failed to delete booking request: ${bookingDeleteError.message}`);

    // Also soft-delete the corresponding event in the 'events' table
    const { error: eventDeleteError } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('booking_request_id', eventId); // Find event by the booking_request_id foreign key

    if (eventDeleteError) {
      console.warn(`[CalendarService] Booking request ${eventId} was deleted, but failed to delete its linked event. This may be normal if no event was created.`);
    }

    clearCalendarCache();
    return { success: true };
  }

  // If it's not a booking request, proceed with logic for regular, user-created events.
  const { data: eventToDelete, error: findError } = await supabase
      .from('events')
      .select('id, parent_event_id, is_recurring')
      .eq('id', eventId)
      .single();

  if (findError || !eventToDelete) {
      throw new Error(`Event with ID ${eventId} not found.`);
  }

  // Handle deletion of an entire recurring series
  if (eventToDelete.is_recurring && deleteChoice === 'series') {
    const { error: parentError } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', eventId);
    if (parentError) throw parentError;
    const { error: childrenError } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('parent_event_id', eventId);
    if (childrenError) console.error("Could not delete all child events, but parent was deleted.");
    console.log(`[CalendarService] Deleted event series for parent: ${eventId}`);
  
  // Handle all other cases (single recurring instance or a normal standalone event)
  } else {
    const { error: singleDeleteError } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', eventId);
    if (singleDeleteError) throw singleDeleteError;
    console.log(`[CalendarService] Deleted standalone or single recurring event: ${eventId}`);
  }

  clearCalendarCache();
  return { success: true };
};
