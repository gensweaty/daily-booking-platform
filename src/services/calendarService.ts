
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from '@/lib/types/calendar';

export interface CalendarEventsResponse {
  events: CalendarEventType[];
  bookings: CalendarEventType[];
}

// Enhanced cache clearing with unified invalidation
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

    console.log('[CalendarService] Comprehensive cache cleared');
  } catch (error) {
    console.warn('[CalendarService] Error clearing cache:', error);
  }
};

// Unified cache invalidation that works for both internal and external calendars
export const broadcastCacheInvalidation = (eventId: string, eventType: string): void => {
  try {
    // Broadcast to current window
    const cacheInvalidationEvent = new CustomEvent('calendar-cache-invalidated', {
      detail: { timestamp: Date.now(), eventId, eventType }
    });
    window.dispatchEvent(cacheInvalidationEvent);

    // Broadcast deletion event for immediate UI updates
    const deletionEvent = new CustomEvent('calendar-event-deleted', {
      detail: { eventId, eventType, timestamp: Date.now(), verified: true }
    });
    window.dispatchEvent(deletionEvent);

    // Cross-tab communication via localStorage
    localStorage.setItem('calendar_deletion_sync', JSON.stringify({
      eventId,
      eventType,
      timestamp: Date.now(),
      action: 'delete'
    }));
    
    // Clean up after 2 seconds
    setTimeout(() => {
      localStorage.removeItem('calendar_deletion_sync');
    }, 2000);

    console.log(`[CalendarService] Broadcasted deletion for ${eventType} ${eventId}`);
  } catch (error) {
    console.warn('[CalendarService] Error broadcasting cache invalidation:', error);
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

// Enhanced delete function with proper verification and unified cache invalidation
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<{ success: boolean; verified: boolean }> => {
  try {
    console.log(`[CalendarService] ⚡ Starting deletion: ${eventType} with ID: ${eventId}, userId: ${userId}`);
    
    let deletionSuccess = false;
    let verificationResult = false;
    
    if (eventType === 'booking_request') {
      // This is an approved booking request - soft delete it
      const { data: updatedBooking, error: bookingError } = await supabase
        .from('booking_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .select('id, deleted_at')
        .single();

      if (bookingError) {
        console.error('[CalendarService] Error deleting booking request:', bookingError);
        throw bookingError;
      }
      
      // Verify deletion was successful
      if (updatedBooking && updatedBooking.deleted_at) {
        deletionSuccess = true;
        console.log(`[CalendarService] ✅ Successfully soft deleted booking request: ${eventId}`);
        
        // Double-check by querying the record
        const { data: verifyBooking } = await supabase
          .from('booking_requests')
          .select('id, deleted_at')
          .eq('id', eventId)
          .single();
          
        verificationResult = verifyBooking?.deleted_at ? true : false;
        console.log(`[CalendarService] 🔍 Verification result for booking ${eventId}: ${verificationResult}`);
      }
    } else {
      // This is a regular event - soft delete from events table
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id, parent_event_id, deleted_at')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();

      if (existingEvent && !existingEvent.deleted_at) {
        console.log('[CalendarService] Found event in events table, soft deleting...');
        
        // Soft delete the main event
        const { data: updatedEvent, error: eventError } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', eventId)
          .eq('user_id', userId)
          .select('id, deleted_at')
          .single();

        if (eventError) {
          console.error('[CalendarService] Error deleting event:', eventError);
          throw eventError;
        }

        // Verify deletion was successful
        if (updatedEvent && updatedEvent.deleted_at) {
          deletionSuccess = true;
          console.log(`[CalendarService] ✅ Successfully soft deleted event: ${eventId}`);
          
          // Double-check by querying the record
          const { data: verifyEvent } = await supabase
            .from('events')
            .select('id, deleted_at')
            .eq('id', eventId)
            .single();
            
          verificationResult = verifyEvent?.deleted_at ? true : false;
          console.log(`[CalendarService] 🔍 Verification result for event ${eventId}: ${verificationResult}`);
        }

        // If this is a recurring event (parent), also soft delete all child instances
        if (existingEvent.parent_event_id === null) {
          const { error: childrenError } = await supabase
            .from('events')
            .update({ deleted_at: new Date().toISOString() })
            .eq('parent_event_id', eventId)
            .eq('user_id', userId);

          if (childrenError) {
            console.warn('[CalendarService] Error deleting recurring children:', childrenError);
          } else {
            console.log(`[CalendarService] ✅ Also deleted recurring children for parent: ${eventId}`);
          }
        }
      } else if (existingEvent && existingEvent.deleted_at) {
        console.log(`[CalendarService] Event ${eventId} is already deleted`);
        deletionSuccess = true;
        verificationResult = true;
      } else {
        console.warn(`[CalendarService] Event not found in events table: ${eventId}`);
        throw new Error(`Event ${eventId} not found or access denied`);
      }
    }

    if (!deletionSuccess) {
      throw new Error(`Failed to delete ${eventType} ${eventId}`);
    }

    console.log(`[CalendarService] ⚡ Deletion completed successfully for ID: ${eventId}, verified: ${verificationResult}`);
    
    // Clear all caches and broadcast the change
    clearCalendarCache();
    broadcastCacheInvalidation(eventId, eventType);

    return { success: true, verified: verificationResult };

  } catch (error) {
    console.error(`[CalendarService] ❌ Error in deletion:`, error);
    throw error;
  }
};
