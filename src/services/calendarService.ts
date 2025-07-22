
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

    // Fetch ONLY approved booking requests that DON'T have a corresponding event
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
        // Filter out booking requests that already have corresponding events
        const eventBookingIds = new Set((events || [])
          .filter(e => e.booking_request_id)
          .map(e => e.booking_request_id));
        
        approvedBookings = (bookings || []).filter(booking => 
          !eventBookingIds.has(booking.id)
        );
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
          // Filter out booking requests that already have corresponding events
          const eventBookingIds = new Set((events || [])
            .filter(e => e.booking_request_id)
            .map(e => e.booking_request_id));
          
          approvedBookings = (bookings || []).filter(booking => 
            !eventBookingIds.has(booking.id)
          );
        }
      }
    }

    console.log(`[CalendarService] Fetched ${approvedBookings.length} unique approved booking requests (filtered duplicates)`);

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

    // Convert remaining booking requests to CalendarEventType format
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

    console.log(`[CalendarService] Returning ${validEvents.length} events and ${validBookings.length} unique approved bookings`);
    
    return {
      events: validEvents,
      bookings: validBookings
    };

  } catch (error) {
    console.error('[CalendarService] Error in getUnifiedCalendarEvents:', error);
    throw error;
  }
};

// Enhanced delete function that handles both linked records properly
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] Starting enhanced deletion: ID: ${eventId}, type: ${eventType}, userId: ${userId}`);
    
    let deletedEvent = false;
    let deletedBooking = false;
    let businessId: string | null = null;
    
    // Step 1: Try to find and delete as an event first
    const { data: eventData, error: eventFetchError } = await supabase
      .from('events')
      .select('id, booking_request_id, user_id')
      .eq('id', eventId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (!eventFetchError && eventData) {
      console.log(`[CalendarService] Found event: ${eventId}, booking_request_id: ${eventData.booking_request_id}`);
      
      // Soft delete the event
      const { error: eventDeleteError } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .eq('user_id', userId);

      if (eventDeleteError) {
        console.error('[CalendarService] Error deleting event:', eventDeleteError);
        throw eventDeleteError;
      }
      
      deletedEvent = true;
      console.log(`[CalendarService] Successfully deleted event: ${eventId}`);

      // If this event was created from a booking request, delete the linked booking too
      if (eventData.booking_request_id) {
        console.log(`[CalendarService] Deleting linked booking request: ${eventData.booking_request_id}`);
        
        // First get the business_id for broadcasting
        const { data: bookingData } = await supabase
          .from('booking_requests')
          .select('business_id')
          .eq('id', eventData.booking_request_id)
          .single();
        
        if (bookingData) {
          businessId = bookingData.business_id;
        }
        
        const { error: bookingDeleteError } = await supabase
          .from('booking_requests')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventData.booking_request_id);

        if (bookingDeleteError) {
          console.warn('[CalendarService] Error deleting linked booking request:', bookingDeleteError);
        } else {
          deletedBooking = true;
          console.log(`[CalendarService] Successfully deleted linked booking request: ${eventData.booking_request_id}`);
        }
      }

      // Handle recurring events
      const { error: childrenError } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('parent_event_id', eventId)
        .eq('user_id', userId);

      if (childrenError) {
        console.warn('[CalendarService] Error deleting recurring children:', childrenError);
      }
    }

    // Step 2: If not found as event, try as booking request
    if (!deletedEvent) {
      const { data: bookingData, error: bookingFetchError } = await supabase
        .from('booking_requests')
        .select('id, business_id')
        .eq('id', eventId)
        .is('deleted_at', null)
        .single();

      if (!bookingFetchError && bookingData) {
        console.log(`[CalendarService] Found booking request: ${eventId}, business_id: ${bookingData.business_id}`);
        businessId = bookingData.business_id;
        
        // Verify user has permission to delete this booking (must be business owner)
        const { data: businessProfile } = await supabase
          .from('business_profiles')
          .select('user_id')
          .eq('id', bookingData.business_id)
          .single();
        
        if (!businessProfile || businessProfile.user_id !== userId) {
          throw new Error('Unauthorized: You can only delete bookings for your own business');
        }
        
        // Soft delete the booking request
        const { error: bookingDeleteError } = await supabase
          .from('booking_requests')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId);

        if (bookingDeleteError) {
          console.error('[CalendarService] Error deleting booking request:', bookingDeleteError);
          throw bookingDeleteError;
        }
        
        deletedBooking = true;
        console.log(`[CalendarService] Successfully deleted booking request: ${eventId}`);

        // Also delete any event that was created from this booking
        const { error: linkedEventError } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('booking_request_id', eventId);

        if (linkedEventError) {
          console.warn('[CalendarService] Error deleting linked event:', linkedEventError);
        } else {
          deletedEvent = true;
          console.log(`[CalendarService] Successfully deleted linked event for booking: ${eventId}`);
        }
      }
    }

    // Verify something was actually deleted
    if (!deletedEvent && !deletedBooking) {
      throw new Error(`Event with ID ${eventId} not found in either table or already deleted`);
    }

    console.log(`[CalendarService] Deletion completed - Event: ${deletedEvent}, Booking: ${deletedBooking}`);
    
    // Step 3: Comprehensive cache clearing and broadcasting
    clearCalendarCache();
    
    // Broadcast deletion event with enhanced data
    const deletionEvent = new CustomEvent('calendar-event-deleted', {
      detail: { 
        eventId, 
        eventType: deletedEvent && deletedBooking ? 'both' : (deletedEvent ? 'event' : 'booking_request'),
        businessId: businessId,
        timestamp: Date.now() 
      }
    });
    window.dispatchEvent(deletionEvent);

    // Force localStorage signal for cross-tab sync
    localStorage.setItem('calendar_event_deleted', JSON.stringify({
      eventId,
      eventType: deletedEvent && deletedBooking ? 'both' : (deletedEvent ? 'event' : 'booking_request'),
      businessId: businessId,
      timestamp: Date.now()
    }));
    
    setTimeout(() => {
      localStorage.removeItem('calendar_event_deleted');
    }, 2000);

  } catch (error) {
    console.error(`[CalendarService] Error in enhanced deletion:`, error);
    throw error;
  }
};
