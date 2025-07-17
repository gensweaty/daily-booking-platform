
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from '@/lib/types/calendar';

export interface CalendarEventsResponse {
  events: CalendarEventType[];
  bookings: CalendarEventType[];
}

// Enhanced cache clearing with cross-tab broadcasting
export const clearCalendarCache = (): void => {
  try {
    // Clear session storage cache
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('calendar_events_') || 
          key.startsWith('business_user_id_') ||
          key.startsWith('unified_calendar_')) {
        sessionStorage.removeItem(key);
      }
    });

    // Clear localStorage cache for cross-tab sync
    const localKeys = Object.keys(localStorage);
    localKeys.forEach(key => {
      if (key.startsWith('calendar_cache_') || key.startsWith('calendar_sync_')) {
        localStorage.removeItem(key);
      }
    });

    // Broadcast cache clear event to other tabs
    const cacheInvalidationEvent = new CustomEvent('calendar-cache-invalidated', {
      detail: { timestamp: Date.now() }
    });
    window.dispatchEvent(cacheInvalidationEvent);

    // Use localStorage for cross-tab communication
    localStorage.setItem('calendar_invalidation_signal', Date.now().toString());
    setTimeout(() => {
      localStorage.removeItem('calendar_invalidation_signal');
    }, 1000);

    console.log('[CalendarService] Comprehensive cache cleared with cross-tab broadcast');
  } catch (error) {
    console.warn('[CalendarService] Error clearing cache:', error);
  }
};

export const getUnifiedCalendarEvents = async (
  businessId?: string, 
  businessUserId?: string
): Promise<CalendarEventsResponse> => {
  try {
    console.log('[CalendarService] Fetching unified events for:', { businessId, businessUserId });
    
    const targetUserId = businessUserId;
    
    if (!targetUserId) {
      console.log('[CalendarService] No user ID available');
      return { events: [], bookings: [] };
    }

    // Fetch ALL events from the events table - STRICT deleted_at filtering
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', targetUserId)
      .is('deleted_at', null) // CRITICAL: Only non-deleted events
      .order('start_date', { ascending: true });

    if (eventsError) {
      console.error('[CalendarService] Error fetching events:', eventsError);
      throw eventsError;
    }

    console.log(`[CalendarService] Fetched ${events?.length || 0} events from events table`);

    // Fetch approved booking requests - STRICT deleted_at filtering
    let bookingRequests: any[] = [];
    if (businessId) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .is('deleted_at', null) // CRITICAL: Only non-deleted bookings
        .order('start_date', { ascending: true });

      if (bookingsError) {
        console.error('[CalendarService] Error fetching booking requests:', bookingsError);
      } else {
        bookingRequests = bookings || [];
      }
    }

    console.log(`[CalendarService] Fetched ${bookingRequests.length} approved booking requests`);

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
      deleted_at: event.deleted_at
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

    // TRIPLE validation to ensure no deleted events slip through
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

// Enhanced delete function with cross-event type deletion and immediate sync
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] Starting deletion: ${eventType} with ID:`, eventId);
    
    // Step 1: Delete from the primary table
    if (eventType === 'event') {
      // Soft delete the event
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .eq('user_id', userId);

      if (error) throw error;

      // If this is a recurring event (parent), also soft delete all child instances
      const { error: childrenError } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('parent_event_id', eventId)
        .eq('user_id', userId);

      if (childrenError) {
        console.warn('[CalendarService] Error deleting recurring children:', childrenError);
      }

      // Check if this event is linked to an approved booking request and delete it too
      const { data: linkedBookings } = await supabase
        .from('booking_requests')
        .select('id, business_id')
        .eq('id', eventId)
        .eq('status', 'approved')
        .is('deleted_at', null);

      if (linkedBookings && linkedBookings.length > 0) {
        console.log('[CalendarService] Found linked booking request, deleting it too');
        const { error: bookingError } = await supabase
          .from('booking_requests')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId);

        if (bookingError) {
          console.warn('[CalendarService] Error deleting linked booking:', bookingError);
        }
      }

    } else if (eventType === 'booking_request') {
      // Soft delete the booking request
      const { error } = await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId);

      if (error) throw error;

      // Check if this booking was converted to an event and delete it too
      const { data: linkedEvents } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (linkedEvents && linkedEvents.length > 0) {
        console.log('[CalendarService] Found linked event, deleting it too');
        const { error: eventError } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId)
          .eq('user_id', userId);

        if (eventError) {
          console.warn('[CalendarService] Error deleting linked event:', eventError);
        }
      }
    }

    console.log(`[CalendarService] Successfully deleted ${eventType}:`, eventId);
    
    // Step 2: Immediate and aggressive cache clearing
    clearCalendarCache();
    
    // Step 3: Broadcast deletion event for immediate UI updates
    const deletionEvent = new CustomEvent('calendar-event-deleted', {
      detail: { eventId, eventType, timestamp: Date.now() }
    });
    window.dispatchEvent(deletionEvent);

    // Step 4: Force localStorage signal for cross-tab sync
    localStorage.setItem('calendar_event_deleted', JSON.stringify({
      eventId,
      eventType,
      timestamp: Date.now()
    }));
    
    setTimeout(() => {
      localStorage.removeItem('calendar_event_deleted');
    }, 2000);

  } catch (error) {
    console.error(`[CalendarService] Error deleting ${eventType}:`, error);
    throw error;
  }
};
