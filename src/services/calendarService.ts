
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from '@/lib/types/calendar';

export interface CalendarEventsResponse {
  events: CalendarEventType[];
  bookings: CalendarEventType[];
}

// Define the type for the public calendar events response
interface PublicCalendarEvent {
  event_id: string;
  event_title: string;
  event_start_date: string;
  event_end_date: string;
  event_type: string;
  event_user_id: string;
  event_user_surname?: string;
  event_user_number?: string;
  event_social_network_link?: string;
  event_notes?: string;
  event_payment_status?: string;
  event_payment_amount?: number;
  event_language?: string;
  event_created_at?: string;
  event_deleted_at?: string;
}

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

    // For external calendar, use a direct query to ensure consistency
    if (businessId && businessUserId) {
      console.log('[CalendarService] Fetching for external calendar');
      
      // Fetch events directly with proper filtering
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

      // Fetch approved booking requests that haven't been converted to events
      const { data: bookingRequests, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (bookingError) {
        console.error('[CalendarService] Error fetching booking requests:', bookingError);
        throw bookingError;
      }

      console.log(`[CalendarService] Fetched ${events?.length || 0} events and ${bookingRequests?.length || 0} booking requests`);

      // Filter out booking requests that have been converted to events
      const existingEventBookingIds = new Set(
        (events || [])
          .filter(event => event.booking_request_id)
          .map(event => event.booking_request_id)
      );
      
      const filteredBookingRequests = (bookingRequests || []).filter(booking => 
        !existingEventBookingIds.has(booking.id)
      );

      // Convert events to CalendarEventType format
      const formattedEvents: CalendarEventType[] = (events || []).map(event => ({
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        user_id: event.user_id || '',
        user_surname: event.user_surname,
        user_number: event.user_number,
        social_network_link: event.social_network_link,
        event_notes: event.event_notes,
        payment_status: event.payment_status,
        payment_amount: event.payment_amount,
        type: event.type || 'event',
        language: event.language,
        created_at: event.created_at || new Date().toISOString(),
        deleted_at: event.deleted_at,
        booking_request_id: event.booking_request_id
      }));

      // Convert approved booking requests
      const formattedBookings: CalendarEventType[] = filteredBookingRequests.map(booking => ({
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

      return {
        events: formattedEvents,
        bookings: formattedBookings
      };
    }

    // For internal calendar, fetch directly with strict filtering
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

    // For internal calendar, also fetch booking requests
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

    console.log(`[CalendarService] Fetched ${bookingRequests.length} approved booking requests`);

    // Convert events to CalendarEventType format
    const formattedEvents: CalendarEventType[] = (events || [])
      .filter(event => !event.deleted_at)
      .map(event => ({
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

    // Convert approved booking requests
    const formattedBookings: CalendarEventType[] = bookingRequests
      .filter(booking => !booking.deleted_at)
      .map(booking => ({
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

    console.log(`[CalendarService] Returning ${formattedEvents.length} events and ${formattedBookings.length} bookings`);
    
    return {
      events: formattedEvents,
      bookings: formattedBookings
    };

  } catch (error) {
    console.error('[CalendarService] Error in getUnifiedCalendarEvents:', error);
    throw error;
  }
};

// Enhanced delete function with proper cascading and immediate cache clearing
export const deleteCalendarEvent = async (
  eventId: string, 
  eventType: 'event' | 'booking_request',
  userId: string
): Promise<void> => {
  try {
    console.log(`[CalendarService] Deleting ${eventType} with ID:`, eventId);
    
    if (eventType === 'event') {
      // Get the event to check relationships
      const { data: eventData, error: fetchError } = await supabase
        .from('events')
        .select('booking_request_id, parent_event_id')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[CalendarService] Error fetching event data:', fetchError);
      }

      // Soft delete the event
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
        .eq('user_id', userId);

      if (error) throw error;
      console.log('[CalendarService] Successfully soft deleted event:', eventId);

      // If this event was created from a booking request, also delete the booking request
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

      // If this is a recurring event (parent), also delete all child instances
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
    
    // Aggressive cache clearing with multiple attempts
    clearCalendarCache();
    
    // Wait and clear again to ensure it propagates
    setTimeout(() => {
      clearCalendarCache();
    }, 100);
    
    setTimeout(() => {
      clearCalendarCache();
    }, 500);
    
  } catch (error) {
    console.error(`[CalendarService] Error deleting ${eventType}:`, error);
    throw error;
  }
};

// Enhanced cache clearing function
export const clearCalendarCache = (): void => {
  try {
    // Clear all possible cache keys
    const storageTypes = [sessionStorage, localStorage];
    
    storageTypes.forEach(storage => {
      const keys = Object.keys(storage);
      keys.forEach(key => {
        if (key.includes('calendar') || key.includes('business') || key.includes('event') || key.includes('booking')) {
          storage.removeItem(key);
          console.log('[CalendarService] Cleared cache key:', key);
        }
      });
    });
    
    console.log('[CalendarService] Aggressive cache clearing completed');
  } catch (error) {
    console.warn('[CalendarService] Error clearing cache:', error);
  }
};
