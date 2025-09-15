
import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { getUnifiedCalendarEvents, clearCalendarCache } from "@/services/calendarService";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from '@tanstack/react-query';

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
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
    
    // Set a shorter timeout to ensure booking functionality is always available
    const loadingTimeout = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2000); // Optimized for faster perceived performance
    
    return () => clearTimeout(loadingTimeout);
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
          // Don't show error for network issues - just proceed without user ID
          setIsInitialLoading(false);
          return;
        }
        
        if (data?.user_id) {
          console.log("[External Calendar] Found business user ID:", data.user_id);
          setBusinessUserId(data.user_id);
          sessionStorage.setItem(`business_user_id_${businessId}`, data.user_id);
        } else {
          console.error("No user ID found for business:", businessId);
          // Try to recover from cache, but don't show error to user
          const cachedUserId = sessionStorage.getItem(`business_user_id_${businessId}`);
          if (cachedUserId) {
            console.log("[External Calendar] Recovered business user ID from session storage:", cachedUserId);
            setBusinessUserId(cachedUserId);
          }
          setIsInitialLoading(false); // Always stop loading to show booking functionality
        }
      } catch (error) {
        console.error("Exception fetching business user ID:", error);
        // Don't show error to user, just stop loading
        setIsInitialLoading(false);
      }
    };
    
    getBusinessUserId();
  }, [businessId, retryCount]);

  // Step 2: Fetch all events using the unified calendar service with optimized polling
  useEffect(() => {
    let isMounted = true;
    
    const fetchAllEvents = async (showLoading = false) => {
      if (!businessId || !businessUserId) return;
      
      if (showLoading) {
        setIsInitialLoading(true);
      }
      
      console.log("[External Calendar] Starting to fetch events for business ID:", businessId, "user ID:", businessUserId);
      
      try {
        // Use the unified calendar service for consistency
        const { events: unifiedEvents, bookings: unifiedBookings } = await getUnifiedCalendarEvents(businessId, businessUserId);
        
        console.log(`[External Calendar] Fetched ${unifiedEvents.length} events and ${unifiedBookings.length} bookings`);
        
        // Combine all events - this should match exactly what the internal calendar shows
        const allEvents: CalendarEventType[] = [...unifiedEvents, ...unifiedBookings];
        
        // STRICT validation to ensure no deleted events and no duplicates
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
          // Store events in session storage for recovery (debounced to reduce writes)
          if (showLoading || Date.now() % 30000 < 1000) { // Only store every 30 seconds for background updates
            try {
              sessionStorage.setItem(`calendar_events_${businessId}`, JSON.stringify(uniqueEvents));
            } catch (e) {
              // Silent fail for storage issues
            }
          }
          
          setEvents(uniqueEvents);
          setLoadingError(null);
          if (showLoading) {
            setIsInitialLoading(false);
          }
        }
      } catch (error) {
        console.error("Exception in ExternalCalendar.fetchAllEvents:", error);
        
        if (isMounted) {
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
          
          // Always stop loading even if there's an error to show booking functionality
          if (showLoading) {
            setIsInitialLoading(false);
          }
          
          // Silently handle network errors to prevent blocking the calendar interface
        }
      }
    };

    if (businessId && businessUserId) {
      console.log("[External Calendar] Have business ID and user ID, fetching events");
      // Initial load with loading indicator
      fetchAllEvents(true);
      
      // Optimized background polling - 10 seconds for better performance on slow connections
      const intervalId = setInterval(() => {
        // Background update without loading indicator
        fetchAllEvents(false);
      }, 10000);
      
      return () => {
        isMounted = false;
        clearInterval(intervalId);
      };
    }
    
    return () => {
      isMounted = false;
    };
  }, [businessId, businessUserId, toast, t, retryCount]);

  // Listen for cache invalidation and deletion events
  useEffect(() => {
    const handleCacheInvalidation = () => {
      console.log('[External Calendar] Cache invalidation detected, refetching...');
      setRetryCount(prev => prev + 1);
    };

    const handleEventDeletion = (event: CustomEvent) => {
      console.log('[External Calendar] Event deletion detected:', event.detail);
      clearCalendarCache();
      setRetryCount(prev => prev + 1);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'calendar_invalidation_signal' || event.key === 'calendar_event_deleted') {
        console.log('[External Calendar] Cross-tab sync detected, refetching...');
        clearCalendarCache();
        setRetryCount(prev => prev + 1);
      }
    };

    window.addEventListener('calendar-cache-invalidated', handleCacheInvalidation);
    window.addEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('calendar-cache-invalidated', handleCacheInvalidation);
      window.removeEventListener('calendar-event-deleted', handleEventDeletion as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Real-time subscriptions for immediate database sync
  useEffect(() => {
    if (!businessId || !businessUserId) return;

    console.log("[External Calendar] Setting up real-time subscriptions");

    // Single optimized real-time subscription for both events and bookings
    const realtimeChannel = supabase
      .channel(`external_calendar_${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${businessUserId}`
        },
        () => {
          clearCalendarCache();
          queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
          queryClient.invalidateQueries({ queryKey: ['events', businessUserId] });
          setRetryCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_requests',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          clearCalendarCache();
          queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
          queryClient.invalidateQueries({ queryKey: ['events', businessUserId] });
          setRetryCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
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
          {isInitialLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-primary">{t("common.loading")}</span>
              </div>
            </div>
          )}
          
          {/* Removed error display to always show calendar interface for booking */}
          
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
