
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
      // First get all approved booking requests that are NOT deleted
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

// ENHANCED: Improved atomic delete function with better verification and logging
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] 🔍 Starting ENHANCED atomic deletion:`);
    console.log(`[CalendarService] - Event ID: ${eventId}`);
    console.log(`[CalendarService] - Event Type: ${eventType}`);
    console.log(`[CalendarService] - User ID: ${userId}`);
    
    if (eventType === 'event') {
      // For events, first check if it's linked to a booking request
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
      
      if (eventData?.booking_request_id) {
        // This is an event created from a booking request - use atomic deletion
        console.log(`[CalendarService] 🎯 Event linked to booking request ${eventData.booking_request_id}, using atomic deletion`);
        
        // First, soft delete the booking request
        const { error: bookingDeleteError } = await supabase
          .from('booking_requests')
          .update({ 
            deleted_at: new Date().toISOString(),
            status: 'rejected'
          })
          .eq('id', eventData.booking_request_id);
        
        if (bookingDeleteError) {
          console.error('[CalendarService] ❌ Error deleting linked booking request:', bookingDeleteError);
          throw bookingDeleteError;
        }
        
        console.log(`[CalendarService] ✅ Linked booking request ${eventData.booking_request_id} deleted`);
      }
      
      // Now delete the event itself
      const { error: eventDeleteError } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .eq('user_id', userId);
        
      if (eventDeleteError) {
        console.error('[CalendarService] ❌ Error deleting event:', eventDeleteError);
        throw eventDeleteError;
      }
      
      console.log(`[CalendarService] ✅ Event ${eventId} deleted successfully`);
      
    } else if (eventType === 'booking_request') {
      // For booking requests, soft delete directly
      console.log(`[CalendarService] 📋 Deleting booking request directly`);
      
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
      
      console.log(`[CalendarService] ✅ Booking request ${eventId} deleted successfully`);
    }
    
    // Comprehensive cache clearing
    console.log(`[CalendarService] 🧹 Starting comprehensive cache invalidation...`);
    clearCalendarCache();
    
    // Broadcast deletion event for immediate UI updates
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
