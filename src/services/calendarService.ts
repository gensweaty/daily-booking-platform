
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
      .is('deleted_at', null)
      .order('start_date', { ascending: true });

    if (eventsError) {
      console.error('[CalendarService] Error fetching events:', eventsError);
      throw eventsError;
    }

    console.log(`[CalendarService] Fetched ${events?.length || 0} events from events table`);

    // Fetch ONLY pending booking requests OR approved ones that don't have a corresponding event
    let bookingRequests: any[] = [];
    if (businessId) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (bookingsError) {
        console.error('[CalendarService] Error fetching booking requests:', bookingsError);
      } else {
        // Create a Set of event IDs and event time slots for deduplication
        const eventIds = new Set((events || []).map(e => e.id));
        const eventTimeSlots = new Set((events || []).map(e => 
          `${e.start_date}-${e.end_date}-${e.user_surname || e.title}`
        ));

        // Filter booking requests to avoid duplicates
        bookingRequests = (bookings || []).filter(booking => {
          // Don't include if there's already an event with the same ID
          if (eventIds.has(booking.id)) {
            console.log(`[CalendarService] Filtering out booking ${booking.id} - duplicate event exists`);
            return false;
          }

          // For approved bookings, check if there's a matching event by time slot and name
          if (booking.status === 'approved') {
            const bookingTimeSlot = `${booking.start_date}-${booking.end_date}-${booking.requester_name || booking.title}`;
            if (eventTimeSlots.has(bookingTimeSlot)) {
              console.log(`[CalendarService] Filtering out approved booking ${booking.id} - matching event exists`);
              return false;
            }
          }

          // Include pending bookings and approved bookings without matching events
          return true;
        });
      }
    }

    console.log(`[CalendarService] Fetched ${bookingRequests.length} unique booking requests (after deduplication)`);

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
      booking_request_id: event.booking_request_id // Important for linking
    }));

    // Convert booking requests to CalendarEventType format
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

    console.log(`[CalendarService] Returning ${validEvents.length} events and ${validBookings.length} bookings (fully deduplicated)`);
    
    return {
      events: validEvents,
      bookings: validBookings
    };

  } catch (error) {
    console.error('[CalendarService] Error in getUnifiedCalendarEvents:', error);
    throw error;
  }
};

// Enhanced delete function with comprehensive cross-table deletion
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] Starting comprehensive deletion: ${eventType} with ID:`, eventId);
    
    // Step 1: Always check and soft delete from events table
    const { data: existingEvent } = await supabase
      .from('events')
      .select('id, parent_event_id, booking_request_id, user_surname, start_date, end_date')
      .eq('id', eventId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (existingEvent) {
      console.log('[CalendarService] Found event in events table, soft deleting...');
      
      // Soft delete the main event
      const { error: eventError } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .eq('user_id', userId);

      if (eventError) {
        console.error('[CalendarService] Error deleting event:', eventError);
        throw eventError;
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

      // If this event has a linked booking_request_id, delete that too
      if (existingEvent.booking_request_id) {
        console.log(`[CalendarService] Deleting linked booking request: ${existingEvent.booking_request_id}`);
        const { error: linkedBookingError } = await supabase
          .from('booking_requests')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existingEvent.booking_request_id);

        if (linkedBookingError) {
          console.warn('[CalendarService] Error deleting linked booking request:', linkedBookingError);
        }
      }
    }

    // Step 2: Check if this is a booking request and handle it
    const { data: existingBooking } = await supabase
      .from('booking_requests')
      .select('id, business_id, requester_name, start_date, end_date')
      .eq('id', eventId)
      .is('deleted_at', null)
      .single();

    if (existingBooking) {
      console.log('[CalendarService] Found booking request, soft deleting...');
      
      const { error: bookingError } = await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId);

      if (bookingError) {
        console.error('[CalendarService] Error deleting booking request:', bookingError);
        throw bookingError;
      }

      // Also check for any events that might have been created from this booking request
      // (in case they share the same ID or have similar time slots)
      const { error: relatedEventsError } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('booking_request_id', eventId)
        .eq('user_id', userId);

      if (relatedEventsError) {
        console.warn('[CalendarService] Error deleting related events:', relatedEventsError);
      }
    }

    // Step 3: Additional cleanup - look for events with matching time slots and names
    // This handles cases where events were created from bookings but not properly linked
    if (existingEvent || existingBooking) {
      const referenceData = existingEvent || existingBooking;
      const referenceName = existingEvent?.user_surname || existingBooking?.requester_name;
      
      if (referenceName && referenceData.start_date && referenceData.end_date) {
        console.log('[CalendarService] Performing additional cleanup for matching time slots...');
        
        // Clean up any remaining duplicates in events table
        const { error: duplicateEventsError } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('start_date', referenceData.start_date)
          .eq('end_date', referenceData.end_date)
          .eq('user_surname', referenceName)
          .is('deleted_at', null)
          .neq('id', eventId); // Don't double-delete the same event

        if (duplicateEventsError) {
          console.warn('[CalendarService] Error cleaning up duplicate events:', duplicateEventsError);
        }

        // Clean up any remaining duplicates in booking_requests table
        if (existingBooking) {
          const { error: duplicateBookingsError } = await supabase
            .from('booking_requests')
            .update({ deleted_at: new Date().toISOString() })
            .eq('business_id', existingBooking.business_id)
            .eq('start_date', referenceData.start_date)
            .eq('end_date', referenceData.end_date)
            .eq('requester_name', referenceName)
            .is('deleted_at', null)
            .neq('id', eventId); // Don't double-delete the same booking

          if (duplicateBookingsError) {
            console.warn('[CalendarService] Error cleaning up duplicate bookings:', duplicateBookingsError);
          }
        }
      }
    }

    console.log(`[CalendarService] Successfully completed comprehensive deletion for ID: ${eventId}`);
    
    // Step 4: Immediate and aggressive cache clearing
    clearCalendarCache();
    
    // Step 5: Broadcast deletion event for immediate UI updates
    const deletionEvent = new CustomEvent('calendar-event-deleted', {
      detail: { eventId, eventType, timestamp: Date.now() }
    });
    window.dispatchEvent(deletionEvent);

    // Step 6: Force localStorage signal for cross-tab sync
    localStorage.setItem('calendar_event_deleted', JSON.stringify({
      eventId,
      eventType,
      timestamp: Date.now()
    }));
    
    setTimeout(() => {
      localStorage.removeItem('calendar_event_deleted');
    }, 2000);

  } catch (error) {
    console.error(`[CalendarService] Error in comprehensive deletion:`, error);
    throw error;
  }
};
