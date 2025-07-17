
import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { getUnifiedCalendarEvents, clearCalendarCache } from "@/services/calendarService";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from '@tanstack/react-query';

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const { toast } = useToast();
  const [businessUserId, setBusinessUserId] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Diagnostic logging for businessId
  useEffect(() => {
    console.log("[External Calendar] Mounted with business ID:", businessId);
    setLoadingError(null);
    clearCalendarCache();
  }, [businessId]);

  // Retry mechanism for failed API calls
  useEffect(() => {
    if (loadingError) {
      const retryTimer = setTimeout(() => {
        if (retryCount < 3) {
          console.log(`[External Calendar] Retrying API call, attempt ${retryCount + 1}`);
          setRetryCount(prev => prev + 1);
          setLoadingError(null);
        }
      }, 3000);
      
      return () => clearTimeout(retryTimer);
    }
  }, [loadingError, retryCount]);

  // Step 1: Get the business user ID
  useEffect(() => {
    const getBusinessUserId = async () => {
      if (!businessId) return;
      
      try {
        console.log("[External Calendar] Fetching business user ID for business:", businessId);
        const { data, error } = await supabase
          .from("business_profiles")
          .select("user_id")
          .eq("id", businessId)
          .single();
        
        if (error) {
          console.error("Error fetching business profile:", error);
          setLoadingError("Failed to fetch business user information");
          return;
        }
        
        if (data?.user_id) {
          console.log("[External Calendar] Found business user ID:", data.user_id);
          setBusinessUserId(data.user_id);
          sessionStorage.setItem(`business_user_id_${businessId}`, data.user_id);
        } else {
          console.error("No user ID found for business:", businessId);
          setLoadingError("Invalid business profile");
          
          const cachedUserId = sessionStorage.getItem(`business_user_id_${businessId}`);
          if (cachedUserId) {
            console.log("[External Calendar] Recovered business user ID from session storage:", cachedUserId);
            setBusinessUserId(cachedUserId);
          }
        }
      } catch (error) {
        console.error("Exception fetching business user ID:", error);
        setLoadingError("Failed to load business information");
      }
    };
    
    getBusinessUserId();
  }, [businessId, retryCount]);

  // Step 2: Fetch all events using the unified calendar service with silent background updates
  useEffect(() => {
    let isMounted = true;
    
    const fetchAllEvents = async (showLoading = false) => {
      if (!businessId || !businessUserId) return;
      
      if (showLoading) {
        setIsInitialLoading(true);
        setIsBackgroundLoading(false);
      } else {
        setIsBackgroundLoading(true);
        setIsInitialLoading(false);
      }
      
      console.log("[External Calendar] Starting to fetch events for business ID:", businessId, "user ID:", businessUserId);
      
      try {
        // Use the unified calendar service for consistency
        const { events: unifiedEvents, bookings: unifiedBookings } = await getUnifiedCalendarEvents(businessId, businessUserId);
        
        console.log(`[External Calendar] Fetched ${unifiedEvents.length} events and ${unifiedBookings.length} bookings`);
        
        // Combine all events - this should now be properly deduplicated
        const allEvents: CalendarEventType[] = [...unifiedEvents, ...unifiedBookings];
        
        // Additional safety check for deleted events
        const validEvents = allEvents.filter(event => !event.deleted_at);
        
        // Additional deduplication by ID to ensure no duplicates
        const uniqueEvents = validEvents.filter((event, index, self) => 
          index === self.findIndex(e => e.id === event.id)
        );
        
        if (validEvents.length !== allEvents.length) {
          console.warn(`[External Calendar] Filtered out ${allEvents.length - validEvents.length} deleted events`);
        }
        
        if (uniqueEvents.length !== validEvents.length) {
          console.warn(`[External Calendar] Removed ${validEvents.length - uniqueEvents.length} duplicate events`);
        }
        
        console.log(`[External Calendar] Final unique events to display: ${uniqueEvents.length}`);
        
        if (isMounted) {
          // Store events in session storage for recovery
          try {
            sessionStorage.setItem(`calendar_events_${businessId}`, JSON.stringify(uniqueEvents));
          } catch (e) {
            console.warn("Failed to store events in session storage:", e);
          }
          
          setEvents(uniqueEvents);
          setLoadingError(null);
          setIsInitialLoading(false);
          setIsBackgroundLoading(false);
        }
      } catch (error) {
        console.error("Exception in ExternalCalendar.fetchAllEvents:", error);
        
        if (isMounted) {
          setLoadingError("Failed to load calendar events");
          setIsBackgroundLoading(false);
          
          // Try to recover events from session storage
          try {
            const cachedEvents = sessionStorage.getItem(`calendar_events_${businessId}`);
            if (cachedEvents) {
              console.log("[External Calendar] Recovering events from session storage");
              setEvents(JSON.parse(cachedEvents));
            }
          } catch (e) {
            console.error("Failed to recover events from session storage:", e);
          }
          
          if (showLoading) {
            setIsInitialLoading(false);
          }
          
          toast({
            title: t("common.error"),
            description: t("common.error"),
            variant: "destructive"
          });
        }
      }
    };

    if (businessId && businessUserId) {
      console.log("[External Calendar] Have business ID and user ID, fetching events");
      // Initial load with loading indicator
      fetchAllEvents(true);
      
      // Silent background polling every 3 seconds
      const intervalId = setInterval(() => {
        // Background update without visible loading indicator
        fetchAllEvents(false);
      }, 3000);
      
      return () => {
        isMounted = false;
        clearInterval(intervalId);
      };
    }
    
    return () => {
      isMounted = false;
    };
  }, [businessId, businessUserId, toast, t, retryCount]);

  // Listen for cache invalidation and deletion events with immediate updates
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const debouncedRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 100);
    };

    const handleCacheInvalidation = () => {
      console.log('[External Calendar] Cache invalidation detected, immediate refresh...');
      debouncedRefresh();
    };

    const handleEventDeletion = (event: CustomEvent) => {
      console.log('[External Calendar] Event deletion detected:', event.detail);
      clearCalendarCache();
      
      // Immediate optimistic update - remove the deleted event from local state
      const deletedEventId = event.detail.eventId;
      if (deletedEventId) {
        setEvents(prevEvents => prevEvents.filter(evt => evt.id !== deletedEventId));
      }
      
      // Then trigger a refresh to ensure consistency
      debouncedRefresh();
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'calendar_invalidation_signal' || event.key === 'calendar_event_deleted') {
        console.log('[External Calendar] Cross-tab sync detected, immediate refresh...');
        clearCalendarCache();
        
        // Handle deletion signal from other tabs
        if (event.key === 'calendar_event_deleted' && event.newValue) {
          try {
            const deleteData = JSON.parse(event.newValue);
            setEvents(prevEvents => prevEvents.filter(evt => evt.id !== deleteData.eventId));
          } catch (e) {
            console.warn('Failed to parse deletion signal:', e);
          }
        }
        
        debouncedRefresh();
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
  }, []);

  // Real-time subscriptions for immediate database sync
  useEffect(() => {
    if (!businessId || !businessUserId) return;

    console.log("[External Calendar] Setting up real-time subscriptions");

    let debounceTimer: NodeJS.Timeout;

    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        clearCalendarCache();
        queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
        queryClient.invalidateQueries({ queryKey: ['events', businessUserId] });
        setRetryCount(prev => prev + 1);
      }, 200);
    };

    // Subscribe to changes in events table
    const eventsChannel = supabase
      .channel(`external_calendar_events_${businessId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${businessUserId}`
        },
        (payload) => {
          console.log('[External Calendar] Events table changed:', payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    // Subscribe to changes in booking_requests table
    const bookingsChannel = supabase
      .channel(`external_calendar_bookings_${businessId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests',
          filter: `business_id=eq.${businessId}`
        },
        (payload) => {
          console.log('[External Calendar] Booking requests table changed:', payload);
          debouncedUpdate();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      console.log('[External Calendar] Cleaning up real-time subscriptions');
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [businessId, businessUserId, queryClient]);

  if (!businessId) {
    return (
      <Card className="min-h-[calc(100vh-12rem)]">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No business selected</p>
        </CardContent>
      </Card>
    );
  }
  
  console.log("[ExternalCalendar] Rendering with events:", events.length);
  
  return (
    <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
      <CardContent className="p-0">
        <div className="px-6 pt-6 relative">
          {/* Only show loading spinner for initial load, not background updates */}
          {isInitialLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-primary">{t("common.loading")}</span>
              </div>
            </div>
          )}
          
          {/* Silent background loading indicator (optional, very subtle) */}
          {isBackgroundLoading && !isInitialLoading && (
            <div className="absolute top-2 right-2 z-10">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse opacity-50"></div>
            </div>
          )}
          
          {loadingError && !events.length && (
            <div className="bg-background/80 py-8 text-center">
              <p className="text-red-500 mb-2">{loadingError}</p>
              <Button onClick={() => setRetryCount(prev => prev + 1)} className="mt-2">
                Retry Loading
              </Button>
            </div>
          )}
          
          <Calendar 
            defaultView={view}
            currentView={view}
            onViewChange={setView}
            isExternalCalendar={true}
            businessId={businessId}
            businessUserId={businessUserId}
            showAllEvents={true}
            allowBookingRequests={true}
            directEvents={events}
          />
        </div>
      </CardContent>
    </Card>
  );
};
