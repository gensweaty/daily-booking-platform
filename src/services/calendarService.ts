
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from '@/lib/types/calendar';

export interface CalendarEventsResponse {
  events: CalendarEventType[];
  bookings: CalendarEventType[];
}

export const getUnifiedCalendarEvents = async (
  businessId?: string, 
  businessUserId?: string
): Promise<CalendarEventsResponse> => {
  try {
    console.log('[CalendarService] Fetching unified events for:', { businessId, businessUserId });
    
    // Determine which user's events to fetch
    const targetUserId = businessUserId;
    
    if (!targetUserId) {
      console.log('[CalendarService] No user ID available');
      return { events: [], bookings: [] };
    }

    // Fetch ALL events from the events table (including recurring instances)
    // This should include ALL event types: regular events, recurring events, CRM-created events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', targetUserId)
      .is('deleted_at', null)
      .order('start_date', { ascending: true });

    if (eventsError) {
      console.error('[CalendarService] Error fetching events:', eventsError);
      throw eventsError;
    }

    console.log(`[CalendarService] Fetched ${events?.length || 0} events from events table`);

    // Fetch approved booking requests that are NOT yet converted to events
    // Only include approved booking requests that don't have a corresponding event
    let bookingRequests: any[] = [];
    if (businessId) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved') // Only approved bookings should show as "booked"
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (bookingsError) {
        console.error('[CalendarService] Error fetching booking requests:', bookingsError);
        // Don't throw here, just log the error and continue with empty bookings
      } else {
        // Filter out booking requests that have already been converted to events
        // by checking if there's an event with the same booking_request_id
        const existingEventBookingIds = new Set(
          (events || [])
            .filter(event => event.booking_request_id)
            .map(event => event.booking_request_id)
        );
        
        bookingRequests = (bookings || []).filter(booking => 
          !existingEventBookingIds.has(booking.id)
        );
      }
    }

    console.log(`[CalendarService] Fetched ${bookingRequests.length} approved booking requests (not yet converted to events)`);

    // Convert events to CalendarEventType format
    const formattedEvents: CalendarEventType[] = (events || []).map(event => ({
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
      type: event.type || 'event',
      is_recurring: event.is_recurring || false,
      repeat_pattern: event.repeat_pattern,
      repeat_until: event.repeat_until,
      parent_event_id: event.parent_event_id,
      language: event.language,
      created_at: event.created_at || new Date().toISOString(),
      deleted_at: event.deleted_at,
      booking_request_id: event.booking_request_id // Include this to track converted bookings
    }));

    // Convert approved booking requests to CalendarEventType format
    // Only include booking requests that haven't been converted to events
    const formattedBookings: CalendarEventType[] = bookingRequests.map(booking => ({
      id: booking.id,
      title: booking.title,
      start_date: booking.start_date,
      end_date: booking.end_date,
      user_id: booking.user_id || '',
      user_surname: booking.requester_name,
      user_number: booking.requester_phone,
      social_network_link: booking.requester_email,
      event_notes: booking.description,
      payment_status: booking.payment_status,
      payment_amount: booking.payment_amount,
      type: 'booking_request',
      language: booking.language,
      created_at: booking.created_at || new Date().toISOString(),
      deleted_at: booking.deleted_at
    }));

    // Final validation to ensure no deleted events slip through
    const validEvents = formattedEvents.filter(event => !event.deleted_at);
    const validBookings = formattedBookings.filter(booking => !booking.deleted_at);

    console.log(`[CalendarService] Returning ${validEvents.length} events and ${validBookings.length} bookings`);
    console.log('[CalendarService] Event details:', validEvents.map(e => ({ 
      id: e.id, 
      title: e.title, 
      start: e.start_date, 
      type: e.type,
      booking_request_id: e.booking_request_id
    })));
    
    return {
      events: validEvents,
      bookings: validBookings
    };

  } catch (error) {
    console.error('[CalendarService] Error in getUnifiedCalendarEvents:', error);
    throw error;
  }
};

// Unified delete function that handles both events and booking requests
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] Deleting ${eventType} with ID:`, eventId);
    
    if (eventType === 'event') {
      // Get the event to check if it has a booking_request_id
      const { data: eventData, error: fetchError } = await supabase
        .from('events')
        .select('booking_request_id')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        console.error('[CalendarService] Error fetching event data:', fetchError);
      }

      // Soft delete the event
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .eq('user_id', userId);

      if (error) throw error;

      // If this event was created from a booking request, also soft delete the booking request
      if (eventData?.booking_request_id) {
        console.log(`[CalendarService] Also deleting related booking request: ${eventData.booking_request_id}`);
        const { error: bookingError } = await supabase
          .from('booking_requests')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventData.booking_request_id);

        if (bookingError) {
          console.warn('[CalendarService] Error deleting related booking request:', bookingError);
        }
      }

      // If this is a recurring event (parent), also soft delete all child instances
      const { error: childrenError } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('parent_event_id', eventId)
        .eq('user_id', userId);

      if (childrenError) {
        console.warn('[CalendarService] Error deleting recurring children:', childrenError);
      }

    } else if (eventType === 'booking_request') {
      const { error } = await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId);

      if (error) throw error;
    }

    console.log(`[CalendarService] Successfully deleted ${eventType}:`, eventId);
    
    // Clear any cached data
    clearCalendarCache();
    
  } catch (error) {
    console.error(`[CalendarService] Error deleting ${eventType}:`, error);
    throw error;
  }
};

// Clear cache function
export const clearCalendarCache = (): void => {
  try {
    // Clear session storage cache
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('calendar_events_') || key.startsWith('business_user_id_')) {
        sessionStorage.removeItem(key);
      }
    });
    console.log('[CalendarService] Cleared calendar cache');
  } catch (error) {
    console.warn('[CalendarService] Error clearing cache:', error);
  }
};
