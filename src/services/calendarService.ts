
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

// Enhanced delete function with proper business ownership verification
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string,
  businessId?: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] Starting deletion: ${eventType} with ID: ${eventId}, userId: ${userId}, businessId: ${businessId}`);
    
    let targetBusinessId = businessId; // Declare at function scope
    
    if (eventType === 'booking_request') {
      // For booking requests, we need to verify business ownership
      
      // If no businessId provided, get it from the booking request
      if (!targetBusinessId) {
        const { data: bookingData, error: fetchError } = await supabase
          .from('booking_requests')
          .select('business_id')
          .eq('id', eventId)
          .single();
          
        if (fetchError || !bookingData) {
          console.error('[CalendarService] Could not fetch booking request:', fetchError);
          throw new Error('Booking request not found');
        }
        
        targetBusinessId = bookingData.business_id;
      }
      
      // Verify the current user owns this business
      const { data: businessOwner, error: businessError } = await supabase
        .from('business_profiles')
        .select('user_id')
        .eq('id', targetBusinessId)
        .single();
        
      if (businessError || !businessOwner) {
        console.error('[CalendarService] Could not verify business ownership:', businessError);
        throw new Error('Business not found');
      }
      
      if (businessOwner.user_id !== userId) {
        console.error('[CalendarService] User does not own this business');
        throw new Error('Unauthorized: You do not own this business');
      }
      
      // Now we can safely delete the booking request
      const { error: deleteError } = await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .eq('business_id', targetBusinessId);

      if (deleteError) {
        console.error('[CalendarService] Error deleting booking request:', deleteError);
        throw deleteError;
      }
      
      console.log(`[CalendarService] Successfully soft deleted booking request: ${eventId} from business: ${targetBusinessId}`);
    } else {
      // This is a regular event - use existing logic
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id, parent_event_id')
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
        
        console.log(`[CalendarService] Successfully soft deleted event: ${eventId}`);
      } else {
        console.warn(`[CalendarService] Event not found in events table: ${eventId}`);
        throw new Error('Event not found or access denied');
      }
    }

    console.log(`[CalendarService] Successfully completed deletion for ID: ${eventId}`);
    
    // Enhanced cache clearing with business context
    clearCalendarCache();
    
    // Broadcast deletion event with business context
    const deletionEvent = new CustomEvent('calendar-event-deleted', {
      detail: { 
        eventId, 
        eventType, 
        businessId: targetBusinessId,
        timestamp: Date.now() 
      }
    });
    window.dispatchEvent(deletionEvent);

    // Enhanced cross-tab sync with business context
    localStorage.setItem('calendar_event_deleted', JSON.stringify({
      eventId,
      eventType,
      businessId: targetBusinessId,
      timestamp: Date.now()
    }));
    
    setTimeout(() => {
      localStorage.removeItem('calendar_event_deleted');
    }, 2000);

  } catch (error) {
    console.error(`[CalendarService] Error in deletion:`, error);
    throw error;
  }
};
