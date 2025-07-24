
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
    return { events: [], bookings: [] };
  }

  // Fetch standard events owned by the user
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', businessUserId)
    .is('deleted_at', null);

  if (eventsError) {
    console.error('[CalendarService] Error fetching events:', eventsError);
    throw eventsError;
  }

  // Fetch approved booking requests for the business, which are displayed as events
  let approvedBookings: any[] = [];
  if (businessId) {
    const { data: bookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .is('deleted_at', null);

    if (bookingsError) {
      console.error('[CalendarService] Error fetching approved bookings:', bookingsError);
    } else {
      approvedBookings = bookings || [];
    }
  }

  const formattedEvents: CalendarEventType[] = (events || []).map(event => ({
    ...event,
    start_date: event.start_date,
    end_date: event.end_date,
    type: 'event', // Explicitly type as 'event'
  }));

  const formattedBookings: CalendarEventType[] = approvedBookings.map(booking => ({
    ...booking,
    start_date: booking.start_date,
    end_date: booking.end_date,
    user_surname: booking.requester_name,
    user_number: booking.requester_phone,
    social_network_link: booking.requester_email,
    event_notes: booking.description,
    type: 'booking_request', // Explicitly type as 'booking_request'
  }));

  return {
    events: formattedEvents,
    bookings: formattedBookings
  };
};

// <<< THIS IS THE NEW, CORRECTED DELETE FUNCTION >>>
export const deleteCalendarEvent = async (
  eventId: string,
  deleteChoice?: "this" | "series"
): Promise<{ success: boolean }> => {
  console.log(`[CalendarService] Deleting event ID: ${eventId} with choice: ${deleteChoice}`);

  // Step 1: Find the event in the 'events' table to check its properties
  const { data: eventToDelete, error: findError } = await supabase
    .from('events')
    .select('id, parent_event_id, booking_request_id, is_recurring')
    .eq('id', eventId)
    .single();

  // If we can't find it in 'events', it must be a 'booking_request'
  if (findError || !eventToDelete) {
    console.log(`[CalendarService] Event not in 'events' table, attempting to delete from 'booking_requests'.`);
    const { error: bookingDeleteError } = await supabase
      .from('booking_requests')
      .update({ deleted_at: new Date().toISOString(), status: 'rejected' })
      .eq('id', eventId);

    if (bookingDeleteError) {
      console.error('[CalendarService] Error soft-deleting booking_request:', bookingDeleteError);
      throw new Error('Failed to delete the booking request.');
    }
    
    console.log(`[CalendarService] Successfully soft-deleted booking_request: ${eventId}`);
    clearCalendarCache();
    return { success: true };
  }

  // Step 2: If we found the event, proceed with deletion logic
  
  // A. Handle deletion of a single instance of a recurring series
  if (eventToDelete.parent_event_id && deleteChoice === 'this') {
      const { error: detachError } = await supabase
          .from('events')
          .update({ parent_event_id: null, is_recurring: false, deleted_at: new Date().toISOString() })
          .eq('id', eventId);
      
      if (detachError) throw new Error("Failed to detach recurring instance.");
      console.log(`[CalendarService] Successfully detached and deleted recurring instance: ${eventId}`);

  // B. Handle deletion of an entire recurring series
  } else if (eventToDelete.is_recurring && deleteChoice === 'series') {
      // Delete the parent event
      const { error: parentError } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId);
      if (parentError) throw parentError;

      // Delete all child events of that series
      const { error: childrenError } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('parent_event_id', eventId);
      if (childrenError) console.error("Could not delete all child events, but parent was deleted.");

      console.log(`[CalendarService] Successfully deleted event series for parent: ${eventId}`);
  
  // C. Handle deletion of any other standalone event (including approved bookings)
  } else {
      const { error: singleDeleteError } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId);
      
      if (singleDeleteError) throw singleDeleteError;
      console.log(`[CalendarService] Successfully deleted standalone event: ${eventId}`);
  }

  // Step 3: If the deleted event was linked to a booking, also delete the booking
  if (eventToDelete.booking_request_id) {
    console.log(`[CalendarService] Event was linked to a booking. Deleting booking_request: ${eventToDelete.booking_request_id}`);
    const { error: bookingDeleteError } = await supabase
      .from('booking_requests')
      .update({ deleted_at: new Date().toISOString(), status: 'rejected' })
      .eq('id', eventToDelete.booking_request_id);

    if (bookingDeleteError) {
      console.warn('[CalendarService] Event was deleted, but failed to delete linked booking_request.');
    }
  }

  clearCalendarCache();
  return { success: true };
};
