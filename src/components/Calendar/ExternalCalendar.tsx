
import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { getUnifiedCalendarEvents, clearCalendarCache } from "@/services/calendarService";
import { useLanguage } from "@/contexts/LanguageContext";

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [businessUserId, setBusinessUserId] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { t } = useLanguage();

  // Diagnostic logging for businessId
  useEffect(() => {
    console.log("[External Calendar] Mounted with business ID:", businessId);
    
    // Reset error state when business ID changes
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
          setLoadingError(null); // Clear error to trigger a new fetch
        }
      }, 3000); // Retry after 3 seconds
      
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
          // Store business user ID in session storage for recovery
          sessionStorage.setItem(`business_user_id_${businessId}`, data.user_id);
        } else {
          console.error("No user ID found for business:", businessId);
          setLoadingError("Invalid business profile");
          
          // Try to recover from session storage
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

  // Step 2: Fetch all events using the unified calendar service
  useEffect(() => {
    const fetchAllEvents = async () => {
      if (!businessId || !businessUserId) return;
      
      setIsLoading(true);
      console.log("[External Calendar] Starting to fetch events for business ID:", businessId, "user ID:", businessUserId);
      
      try {
        // Use the unified calendar service - this ensures we get the SAME data as the internal calendar
        const { events: unifiedEvents, bookings: unifiedBookings } = await getUnifiedCalendarEvents(businessId, businessUserId);
        
        console.log(`[External Calendar] Fetched ${unifiedEvents.length} events and ${unifiedBookings.length} bookings`);
        console.log('[External Calendar] Unified events details:', unifiedEvents.map(e => ({ 
          id: e.id, 
          title: e.title, 
          start: e.start_date, 
          type: e.type 
        })));
        
        // Combine all events - this should match exactly what the internal calendar shows
        const allEvents: CalendarEventType[] = [...unifiedEvents, ...unifiedBookings];
        
        // Additional validation to ensure no deleted events
        const validEvents = allEvents.filter(event => !event.deleted_at);
        
        if (validEvents.length !== allEvents.length) {
          console.warn(`[External Calendar] Filtered out ${allEvents.length - validEvents.length} deleted events`);
        }
        
        console.log(`[External Calendar] Final events to display: ${validEvents.length}`);
        console.log('[External Calendar] Final events details:', validEvents.map(e => ({ 
          id: e.id, 
          title: e.title, 
          start: e.start_date, 
          type: e.type,
          deleted_at: e.deleted_at
        })));
        
        // Store events in session storage for recovery
        try {
          sessionStorage.setItem(`calendar_events_${businessId}`, JSON.stringify(validEvents));
        } catch (e) {
          console.warn("Failed to store events in session storage:", e);
        }
        
        // Update state with fetched events
        setEvents(validEvents);
        setLoadingError(null);
      } catch (error) {
        console.error("Exception in ExternalCalendar.fetchAllEvents:", error);
        setLoadingError("Failed to load calendar events");
        
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
        
        toast({
          title: t("common.error"),
          description: t("common.error"),
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we have both business ID and user ID
    if (businessId && businessUserId) {
      console.log("[External Calendar] Have business ID and user ID, fetching events");
      fetchAllEvents();
      
      // Set up polling to refresh data every 30 seconds to ensure sync
      const intervalId = setInterval(fetchAllEvents, 30000);
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [businessId, businessUserId, toast, t, retryCount]);

  // Real-time subscription for changes - this ensures immediate sync with internal calendar
  useEffect(() => {
    if (!businessId || !businessUserId) return;

    console.log("[External Calendar] Setting up real-time subscription");

    // Subscribe to changes in events table
    const eventsChannel = supabase
      .channel(`external_calendar_events_${businessId}`)
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
          // Clear cache and refetch immediately
          clearCalendarCache();
          setRetryCount(prev => prev + 1);
        }
      )
      .subscribe();

    // Subscribe to changes in booking_requests table
    const bookingsChannel = supabase
      .channel(`external_calendar_bookings_${businessId}`)
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
          // Clear cache and refetch immediately
          clearCalendarCache();
          setRetryCount(prev => prev + 1);
        }
      )
      .subscribe();

    // Subscribe to changes in customers table (for CRM-created events)
    const customersChannel = supabase
      .channel(`external_calendar_customers_${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `user_id=eq.${businessUserId}`
        },
        (payload) => {
          console.log('[External Calendar] Customers table changed:', payload);
          // Clear cache and refetch immediately
          clearCalendarCache();
          setRetryCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(customersChannel);
    };
  }, [businessId, businessUserId]);

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
  console.log("[ExternalCalendar] Events being passed to Calendar component:", events.map(e => ({ 
    id: e.id, 
    title: e.title, 
    start: e.start_date, 
    type: e.type 
  })));
  
  return (
    <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
      <CardContent className="p-0">
        <div className="px-6 pt-6 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <span className="ml-2 text-primary">{t("common.loading")}</span>
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
