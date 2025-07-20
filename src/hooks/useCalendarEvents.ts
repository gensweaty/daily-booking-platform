import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUnifiedCalendarEvents, deleteCalendarEvent, clearCalendarCache } from '@/services/calendarService';
import { useEffect } from 'react';

export const useCalendarEvents = (businessId?: string, businessUserId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchEvents = async (): Promise<CalendarEventType[]> => {
    try {
      const targetUserId = businessUserId || user?.id;
      
      if (!targetUserId) {
        console.log("[useCalendarEvents] No user ID available for fetching events");
        return [];
      }

      console.log("[useCalendarEvents] Fetching events for user:", targetUserId, "business:", businessId);

      // Use the unified calendar service for consistency
      const { events, bookings } = await getUnifiedCalendarEvents(businessId, targetUserId);
      
      // Combine all events and ensure no duplicates
      const allEvents: CalendarEventType[] = [...events, ...bookings];
      
      // Additional deduplication by ID to ensure no duplicates
      const uniqueEvents = allEvents.filter((event, index, self) => 
        index === self.findIndex(e => e.id === event.id && !e.deleted_at)
      );

      console.log(`[useCalendarEvents] ✅ Loaded ${uniqueEvents.length} unique events (${events.length} events + ${bookings.length} approved bookings)`);
      
      return uniqueEvents;

    } catch (error) {
      console.error("[useCalendarEvents] Error in fetchEvents:", error);
      throw error;
    }
  };

  // Use consistent query key structure for both internal and external calendars
  const queryKey = ['calendar-events', businessId || 'default', businessUserId || user?.id];

  const {
    data: events = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey,
    queryFn: fetchEvents,
    enabled: !!(businessUserId || user?.id),
    staleTime: 0, // Always consider data stale for immediate updates
    gcTime: 1000, // Keep in cache for 1 second only
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // AGGRESSIVE cache invalidation with comprehensive query matching
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const forceRefreshAllCalendars = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[useCalendarEvents] 🔄 FORCING COMPLETE CALENDAR REFRESH');
        
        // Clear all calendar-related cache
        clearCalendarCache();
        
        // Invalidate ALL possible calendar query variations
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = String(query.queryKey[0] || '');
            return key.includes('calendar') || 
                   key.includes('events') || 
                   key.includes('optimized') ||
                   key.includes('business');
          }
        });
        
        // Force immediate refetch
        refetch();
      }, 50);
    };

    const handleCacheInvalidation = () => {
      console.log('[useCalendarEvents] 🔔 Cache invalidation signal received');
      forceRefreshAllCalendars();
    };

    const handleEventDeletion = (event: CustomEvent) => {
      console.log('[useCalendarEvents] 🗑️ Event deletion signal received:', event.detail);
      if (event.detail.verified) {
        console.log('[useCalendarEvents] ✅ Verified deletion - forcing immediate refresh');
        forceRefreshAllCalendars();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'calendar_invalidation_signal' || event.key === 'calendar_event_deleted') {
        console.log('[useCalendarEvents] 🔄 Cross-tab sync detected:', event.key);
        forceRefreshAllCalendars();
      }
    };

    window.addEventListener('calendar-cache-invalidated', handleCacheInvalidation);
    window.addEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('calendar-cache-invalidated', handleCacheInvalidation);
      window.removeEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [queryClient, queryKey, refetch]);

  // Enhanced real-time subscriptions with better error handling
  useEffect(() => {
    if (!user?.id && !businessUserId) return;

    const targetUserId = businessUserId || user?.id;
    if (!targetUserId) return;

    console.log('[useCalendarEvents] Setting up real-time subscriptions');

    let debounceTimer: NodeJS.Timeout;

    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[useCalendarEvents] Real-time update triggered');
        clearCalendarCache();
        
        // Invalidate all related queries with predicate
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key === 'calendar-events' || key === 'events' || key === 'business-events' || key === 'optimized-calendar-events';
          }
        });
        
        refetch();
      }, 100);
    };

    // Subscribe to events table changes
    const eventsChannel = supabase
      .channel(`calendar_events_${targetUserId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${targetUserId}`
        },
        (payload) => {
          console.log('[useCalendarEvents] Events table changed:', payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to booking_requests table changes for the business
    let bookingsChannel: any = null;
    if (businessId) {
      bookingsChannel = supabase
        .channel(`calendar_bookings_${businessId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'booking_requests',
            filter: `business_id=eq.${businessId}`
          },
          (payload) => {
            console.log('[useCalendarEvents] Booking requests table changed:', payload);
            debouncedUpdate();
          }
        )
        .subscribe();
    }

    return () => {
      clearTimeout(debounceTimer);
      console.log('[useCalendarEvents] Cleaning up real-time subscriptions');
      supabase.removeChannel(eventsChannel);
      if (bookingsChannel) {
        supabase.removeChannel(bookingsChannel);
      }
    };
  }, [user?.id, businessUserId, businessId, queryClient, queryKey, refetch]);

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType>) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("[useCalendarEvents] Creating event with data:", eventData);

      const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
        p_event_data: {
          title: eventData.user_surname || eventData.title,
          user_surname: eventData.user_surname,
          user_number: eventData.user_number,
          social_network_link: eventData.social_network_link,
          event_notes: eventData.event_notes,
          event_name: eventData.event_name,
          start_date: eventData.start_date,
          end_date: eventData.end_date,
          payment_status: eventData.payment_status || 'not_paid',
          payment_amount: eventData.payment_amount?.toString() || '',
          type: eventData.type || 'event',
          is_recurring: eventData.is_recurring || false,
          repeat_pattern: eventData.repeat_pattern,
          repeat_until: eventData.repeat_until
        },
        p_additional_persons: [],
        p_user_id: user.id,
        p_event_id: null
      });

      if (error) throw error;

      clearCalendarCache();

      return {
        id: savedEventId,
        title: eventData.user_surname || eventData.title || 'Untitled Event',
        start_date: eventData.start_date || new Date().toISOString(),
        end_date: eventData.end_date || new Date().toISOString(),
        user_id: user.id,
        type: eventData.type || 'event',
        created_at: new Date().toISOString(),
        ...eventData
      } as CalendarEventType;
    },
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error: any) => {
      console.error("[useCalendarEvents] Error creating event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (eventData: Partial<CalendarEventType> & { id: string }) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("[useCalendarEvents] Updating event with data:", eventData);

      // Check if this is a booking_request (type === 'booking_request') or regular event
      if (eventData.type === 'booking_request') {
        // Update booking_request table
        const { error } = await supabase
          .from('booking_requests')
          .update({
            title: eventData.user_surname || eventData.title,
            requester_name: eventData.user_surname || eventData.title,
            requester_phone: eventData.user_number,
            requester_email: eventData.social_network_link,
            description: eventData.event_notes,
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            payment_status: eventData.payment_status || 'not_paid',
            payment_amount: eventData.payment_amount || null,
          })
          .eq('id', eventData.id);

        if (error) throw error;

        clearCalendarCache();

        return {
          ...eventData,
          title: eventData.user_surname || eventData.title || 'Untitled Event',
        } as CalendarEventType;
      } else {
        // Update regular event using the existing RPC function
        const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
          p_event_data: {
            title: eventData.user_surname || eventData.title,
            user_surname: eventData.user_surname,
            user_number: eventData.user_number,
            social_network_link: eventData.social_network_link,
            event_notes: eventData.event_notes,
            event_name: eventData.event_name,
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            payment_status: eventData.payment_status || 'not_paid',
            payment_amount: eventData.payment_amount?.toString() || '',
            type: eventData.type || 'event',
            is_recurring: eventData.is_recurring || false,
            repeat_pattern: eventData.repeat_pattern,
            repeat_until: eventData.repeat_until
          },
          p_additional_persons: [],
          p_user_id: user.id,
          p_event_id: eventData.id
        });

        if (error) throw error;

        clearCalendarCache();

        return {
          id: savedEventId,
          title: eventData.user_surname || eventData.title || 'Untitled Event',
          start_date: eventData.start_date || new Date().toISOString(),
          end_date: eventData.end_date || new Date().toISOString(),
          user_id: user.id,
          type: eventData.type || 'event',
          created_at: eventData.created_at || new Date().toISOString(),
          ...eventData
        } as CalendarEventType;
      }
    },
    onSuccess: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("[useCalendarEvents] Error updating event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
    },
  });

  // REWRITTEN delete mutation with comprehensive business context handling
  const deleteEventMutation = useMutation({
    mutationFn: async ({ id, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
      if (!user?.id) throw new Error("User not authenticated");

      console.log("[useCalendarEvents] 🗑️ STARTING DELETE MUTATION for event:", id);

      // Find the event in current events to determine exact type and context
      const eventToDelete = events.find(e => e.id === id);
      
      if (!eventToDelete) {
        console.error("[useCalendarEvents] ❌ Event not found in current events list:", id);
        throw new Error("Event not found in calendar");
      }
      
      console.log("[useCalendarEvents] 📋 Event to delete:", {
        id: eventToDelete.id,
        title: eventToDelete.title,
        type: eventToDelete.type,
        user_id: eventToDelete.user_id
      });

      const eventType = eventToDelete.type === 'booking_request' ? 'booking_request' : 'event';
      
      // Determine business context more reliably
      let currentBusinessId = businessId;
      
      // For booking requests, we MUST have business context
      if (eventType === 'booking_request') {
        if (!currentBusinessId) {
          // Try to get business ID from user's business profile
          const { data: userBusiness, error: businessError } = await supabase
            .from('business_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();
          
          if (businessError) {
            console.error("[useCalendarEvents] ❌ Failed to get user business:", businessError);
          } else if (userBusiness) {
            currentBusinessId = userBusiness.id;
            console.log("[useCalendarEvents] 🏢 Retrieved business ID from user profile:", currentBusinessId);
          }
        }

        if (!currentBusinessId) {
          throw new Error("Business context required for booking request deletion");
        }
      }

      console.log("[useCalendarEvents] 🔍 Final deletion context:", {
        eventType,
        eventId: id,
        userId: user.id,
        businessId: currentBusinessId,
        eventTitle: eventToDelete.title
      });

      // Execute the deletion with proper context
      const result = await deleteCalendarEvent(id, eventType, user.id, currentBusinessId);

      console.log("[useCalendarEvents] ✅ Deletion mutation completed:", result);

      return { 
        success: result.success, 
        eventType, 
        title: eventToDelete.title,
        deletedFrom: result.deletedFrom 
      };
    },
    onSuccess: async (result) => {
      console.log("[useCalendarEvents] 🎉 Delete mutation SUCCESS:", result);
      
      // IMMEDIATE and AGGRESSIVE cache clearing
      clearCalendarCache();
      
      // Invalidate ALL calendar queries with a broad predicate
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = String(query.queryKey[0] || '');
          return key.includes('calendar') || 
                 key.includes('events') || 
                 key.includes('optimized') ||
                 key.includes('business');
        }
      });
      
      // Force multiple refetches to ensure data consistency
      await Promise.all([
        refetch(),
        new Promise(resolve => setTimeout(resolve, 100)),
        refetch()
      ]);
      
      // Broadcast successful deletion
      const deletionEvent = new CustomEvent('calendar-event-deleted', {
        detail: { 
          eventId: result.title,
          eventType: result.eventType,
          timestamp: Date.now(), 
          verified: true,
          deletedFrom: result.deletedFrom
        }
      });
      window.dispatchEvent(deletionEvent);
      
      toast({
        title: "Success",
        description: `${result.eventType === 'booking_request' ? 'Booking request' : 'Event'} "${result.title}" deleted successfully`,
      });
    },
    onError: (error: any) => {
      console.error("[useCalendarEvents] ❌ Delete mutation FAILED:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  return {
    events,
    isLoading,
    error,
    refetch,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
  };
};
