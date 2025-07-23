
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

    // Fetch ONLY approved booking requests for the business that DON'T have corresponding events
    let approvedBookings: any[] = [];
    if (businessId) {
      // First get all approved booking requests
      const { data: allBookings, error: bookingsError } = await supabase
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
        const eventBookingIds = (events || [])
          .map(event => event.booking_request_id)
          .filter(Boolean);
        
        approvedBookings = (allBookings || []).filter(
          booking => !eventBookingIds.includes(booking.id)
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
        const { data: allBookings, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('business_id', userBusiness.id)
          .eq('status', 'approved')
          .is('deleted_at', null)
          .order('start_date', { ascending: true });

        if (!bookingsError) {
          // Filter out booking requests that already have corresponding events
          const eventBookingIds = (events || [])
            .map(event => event.booking_request_id)
            .filter(Boolean);
          
          approvedBookings = (allBookings || []).filter(
            booking => !eventBookingIds.includes(booking.id)
          );
        }
      }
    }

    console.log(`[CalendarService] Fetched ${approvedBookings.length} unique approved booking requests (no corresponding events)`);

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
      booking_request_id: event.booking_request_id // Include this for deletion tracking
    }));

    // Convert approved booking requests to CalendarEventType format (only those without events)
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

    console.log(`[CalendarService] Returning ${formattedEvents.length} events and ${formattedBookings.length} unique approved bookings`);
    
    return {
      events: formattedEvents,
      bookings: formattedBookings
    };

  } catch (error) {
    console.error('[CalendarService] Error in getUnifiedCalendarEvents:', error);
    throw error;
  }
};

// CRITICAL: Enhanced atomic delete function with better debugging and error handling
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] 🔍 Starting ENHANCED atomic deletion analysis:`);
    console.log(`[CalendarService] - Event ID: ${eventId}`);
    console.log(`[CalendarService] - Event Type: ${eventType}`);
    console.log(`[CalendarService] - User ID: ${userId}`);
    
    // STEP 1: First, let's examine what we're about to delete
    if (eventType === 'event') {
      const { data: eventData, error: eventFetchError } = await supabase
        .from('events')
        .select('*, booking_request_id')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();
      
      if (eventFetchError) {
        console.error('[CalendarService] ❌ Error fetching event data:', eventFetchError);
        throw eventFetchError;
      }
      
      console.log(`[CalendarService] 📋 Event data before deletion:`, eventData);
      console.log(`[CalendarService] 🔗 Linked booking request ID: ${eventData?.booking_request_id || 'None'}`);
      
      if (eventData?.booking_request_id) {
        // This is an event created from a booking request - we need atomic deletion
        console.log(`[CalendarService] 🎯 This is a booking-derived event, using ATOMIC deletion`);
        
        // Use atomic delete function
        const { data, error } = await supabase.rpc(
          'delete_event_and_related_booking' as any,
          {
            p_event_id: eventId,
            p_user_id: userId
          }
        );
        
        if (error) {
          console.error('[CalendarService] ❌ Error in atomic delete:', error);
          throw error;
        }
        
        console.log(`[CalendarService] ✅ Atomic deletion completed. Deleted ${data} records`);
        
        // STEP 2: Verify the deletion worked
        const { data: verifyEvent } = await supabase
          .from('events')
          .select('deleted_at')
          .eq('id', eventId)
          .single();
          
        const { data: verifyBooking } = await supabase
          .from('booking_requests')
          .select('deleted_at, status')
          .eq('id', eventData.booking_request_id)
          .single();
          
        console.log(`[CalendarService] 🔍 Post-deletion verification:`);
        console.log(`[CalendarService] - Event deleted_at: ${verifyEvent?.deleted_at || 'NULL'}`);
        console.log(`[CalendarService] - Booking deleted_at: ${verifyBooking?.deleted_at || 'NULL'}`);
        console.log(`[CalendarService] - Booking status: ${verifyBooking?.status || 'NULL'}`);
        
      } else {
        // This is a regular event - simple deletion
        console.log(`[CalendarService] 📝 This is a regular event, using simple deletion`);
        
        const { error } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId)
          .eq('user_id', userId);
          
        if (error) {
          console.error('[CalendarService] ❌ Error in simple delete:', error);
          throw error;
        }
        
        console.log(`[CalendarService] ✅ Simple deletion completed`);
      }
      
    } else if (eventType === 'booking_request') {
      console.log(`[CalendarService] 📋 Deleting booking request directly`);
      
      // For booking requests, soft delete and reject
      const { error } = await supabase
        .from('booking_requests')
        .update({ 
          deleted_at: new Date().toISOString(),
          status: 'rejected'
        })
        .eq('id', eventId);
        
      if (error) {
        console.error('[CalendarService] ❌ Error deleting booking request:', error);
        throw error;
      }
      
      console.log(`[CalendarService] ✅ Booking request deletion completed`);
    }
    
    // STEP 3: Comprehensive cache clearing and broadcasting
    console.log(`[CalendarService] 🧹 Starting comprehensive cache invalidation...`);
    clearCalendarCache();
    
    // Broadcast deletion event
    const deletionEvent = new CustomEvent('calendar-event-deleted', {
      detail: { 
        eventId, 
        eventType, 
        timestamp: Date.now() 
      }
    });
    window.dispatchEvent(deletionEvent);

    // Force localStorage signal for cross-tab sync
    localStorage.setItem('calendar_event_deleted', JSON.stringify({
      eventId,
      eventType,
      timestamp: Date.now()
    }));
    
    setTimeout(() => {
      localStorage.removeItem('calendar_event_deleted');
    }, 2000);

    console.log(`[CalendarService] ✅ DELETION PROCESS COMPLETED SUCCESSFULLY`);

  } catch (error) {
    console.error(`[CalendarService] ❌ CRITICAL ERROR in deletion process:`, error);
    throw error;
  }
};
