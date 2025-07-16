
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
    let bookingRequests: any[] = [];
    if (businessId) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (bookingsError) {
        console.error('[CalendarService] Error fetching booking requests:', bookingsError);
      } else {
        // Filter out booking requests that have already been converted to events
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
      booking_request_id: event.booking_request_id
    }));

    // Convert approved booking requests to CalendarEventType format
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
    
    return {
      events: validEvents,
      bookings: validBookings
    };

  } catch (error) {
    console.error('[CalendarService] Error in getUnifiedCalendarEvents:', error);
    throw error;
  }
};

// Enhanced delete function with proper cascading
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] Starting deletion of ${eventType} with ID:`, eventId);
    
    if (eventType === 'event') {
      // Get the event to check if it has a booking_request_id
      const { data: eventData, error: fetchError } = await supabase
        .from('events')
        .select('booking_request_id, parent_event_id')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[CalendarService] Error fetching event data:', fetchError);
      }

      // Soft delete the event first
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .eq('user_id', userId);

      if (error) throw error;
      console.log('[CalendarService] Successfully soft deleted event:', eventId);

      // If this event was created from a booking request, also soft delete the booking request
      if (eventData?.booking_request_id) {
        console.log(`[CalendarService] Also deleting related booking request: ${eventData.booking_request_id}`);
        const { error: bookingError } = await supabase
          .from('booking_requests')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventData.booking_request_id);

        if (bookingError) {
          console.warn('[CalendarService] Error deleting related booking request:', bookingError);
        } else {
          console.log('[CalendarService] Successfully deleted related booking request');
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
      // First check if there's an event created from this booking request
      const { data: relatedEvents, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('booking_request_id', eventId)
        .is('deleted_at', null);

      if (!eventsError && relatedEvents && relatedEvents.length > 0) {
        console.log(`[CalendarService] Found ${relatedEvents.length} related events to delete`);
        // Soft delete any events created from this booking request
        const { error: eventDeleteError } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('booking_request_id', eventId);

        if (eventDeleteError) {
          console.warn('[CalendarService] Error deleting related events:', eventDeleteError);
        } else {
          console.log('[CalendarService] Successfully deleted related events');
        }
      }

      // Soft delete the booking request
      const { error } = await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId);

      if (error) throw error;
      console.log('[CalendarService] Successfully deleted booking request:', eventId);
    }

    console.log(`[CalendarService] Deletion process completed for ${eventType}:`, eventId);
    
    // Force clear all calendar cache immediately
    clearCalendarCache();
    
    // Trigger a small delay then clear cache again to ensure it's properly cleared
    setTimeout(() => {
      clearCalendarCache();
    }, 100);
    
  } catch (error) {
    console.error(`[CalendarService] Error deleting ${eventType}:`, error);
    throw error;
  }
};

// Enhanced cache clearing function
export const clearCalendarCache = (): void => {
  try {
    // Clear session storage cache
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('calendar_events_') || key.startsWith('business_user_id_')) {
        sessionStorage.removeItem(key);
        console.log('[CalendarService] Cleared cache key:', key);
      }
    });
    
    // Also clear localStorage cache if any
    const localKeys = Object.keys(localStorage);
    localKeys.forEach(key => {
      if (key.startsWith('calendar_events_') || key.startsWith('business_user_id_')) {
        localStorage.removeItem(key);
        console.log('[CalendarService] Cleared localStorage key:', key);
      }
    });
    
    console.log('[CalendarService] Cache clearing completed');
  } catch (error) {
    console.warn('[CalendarService] Error clearing cache:', error);
  }
};
