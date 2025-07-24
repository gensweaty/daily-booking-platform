
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

    // Fetch events from the events table - STRICT deleted_at filtering
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

    // Fetch ONLY approved booking requests for the business
    let approvedBookings: any[] = [];
    if (businessId) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (bookingsError) {
        console.error('[CalendarService] Error fetching approved booking requests:', bookingsError);
      } else {
        approvedBookings = bookings || [];
      }
    } else {
      // If no businessId provided, check if this user has any business and fetch bookings for it
      const { data: userBusiness, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', targetUserId)
        .single();

      if (!businessError && userBusiness) {
        const { data: bookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('business_id', userBusiness.id)
          .eq('status', 'approved')
          .is('deleted_at', null)
          .order('start_date', { ascending: true });

        if (!bookingsError) {
          approvedBookings = bookings || [];
        }
      }
    }

    console.log(`[CalendarService] Fetched ${approvedBookings.length} approved booking requests`);

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
    const formattedBookings: CalendarEventType[] = approvedBookings.map(booking => ({
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

    console.log(`[CalendarService] Returning ${validEvents.length} events and ${validBookings.length} approved bookings`);
    
    return {
      events: validEvents,
      bookings: validBookings
    };

  } catch (error) {
    console.error('[CalendarService] Error in getUnifiedCalendarEvents:', error);
    throw error;
  }
};

// Bulletproof deletion function that handles all cases idempotently
export const deleteCalendarEvent = async (
  eventId: string,
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] Deleting calendar entry: type=${eventType}, id=${eventId}`);
    let bookingIdToDelete: string | undefined = undefined;

    // 1. If it's a booking_request, always also delete any event linked by booking_request_id.
    if (eventType === 'booking_request') {
      // Soft delete booking request
      await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString(), status: 'rejected' })
        .eq('id', eventId);

      // Delete all events that reference this booking
      const { data: linkedEvents } = await supabase
        .from('events')
        .select('id')
        .eq('booking_request_id', eventId)
        .is('deleted_at', null);
      if (linkedEvents && linkedEvents.length > 0) {
        await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', linkedEvents.map(e => e.id));
      }
    } else {
      // 2. If it's an event, soft delete event and any children
      // Fetch event to check for booking_request_id
      const { data: event } = await supabase
        .from('events')
        .select('id, booking_request_id, parent_event_id')
        .eq('id', eventId)
        .is('deleted_at', null)
        .maybeSingle();

      // If event exists
      if (event) {
        // Delete the event
        await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId);

        // Delete all child events (recurring instances)
        await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('parent_event_id', eventId);

        // If it is linked to a booking request, delete that too
        if (event.booking_request_id) {
          bookingIdToDelete = event.booking_request_id;
          await supabase
            .from('booking_requests')
            .update({ deleted_at: new Date().toISOString(), status: 'rejected' })
            .eq('id', event.booking_request_id);
        }
      }
    }

    // 3. As a fallback, always try to delete BOTH sides by ID (safe to re-update)
    // This means: if you delete a booking_request, also try deleting it as event; vice versa.
    await supabase
      .from('booking_requests')
      .update({ deleted_at: new Date().toISOString(), status: 'rejected' })
      .eq('id', eventId);

    await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', eventId);

    if (bookingIdToDelete) {
      await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString(), status: 'rejected' })
        .eq('id', bookingIdToDelete);
    }

    // Cache clearing and sync
    clearCalendarCache();
    window.dispatchEvent(new CustomEvent('calendar-event-deleted', {
      detail: { eventId, eventType, timestamp: Date.now() }
    }));
    localStorage.setItem('calendar_event_deleted', JSON.stringify({
      eventId, eventType, timestamp: Date.now()
    }));
    setTimeout(() => localStorage.removeItem('calendar_event_deleted'), 2000);

    console.log(`[CalendarService] Deleted all linked bookings/events for ID: ${eventId}`);
  } catch (error) {
    console.error(`[CalendarService] Error in deletion:`, error);
    throw error;
  }
};
