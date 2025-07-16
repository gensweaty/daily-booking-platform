
import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { 
  getUnifiedCalendarEvents, 
  clearCalendarCache, 
  initializeBroadcastChannel,
  broadcastCalendarChange 
} from "@/services/calendarService";
import { useLanguage } from "@/contexts/LanguageContext";

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [businessUserId, setBusinessUserId] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const { t } = useLanguage();

  // Initialize broadcast channel for cross-tab communication
  useEffect(() => {
    initializeBroadcastChannel();
  }, []);

  // Diagnostic logging for businessId
  useEffect(() => {
    console.log("[External Calendar] Mounted with business ID:", businessId);
    setLoadingError(null);
    clearCalendarCache();
    setRetryCount(0);
  }, [businessId]);

  // Step 1: Get the business user ID with immediate retry
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
        }
      } catch (error) {
        console.error("Exception fetching business user ID:", error);
        setLoadingError("Failed to load business information");
      }
    };
    
    getBusinessUserId();
  }, [businessId, retryCount]);

  // Step 2: Aggressive event fetching with immediate sync
  useEffect(() => {
    const fetchAllEvents = async () => {
      if (!businessId || !businessUserId) return;
      
      setIsLoading(true);
      console.log("[External Calendar] Starting aggressive event fetch for:", businessId, "user:", businessUserId);
      
      try {
        // Always clear cache before fetching to ensure fresh data
        clearCalendarCache();
        
        // Use the unified calendar service with aggressive cache busting
        const { events: unifiedEvents, bookings: unifiedBookings } = await getUnifiedCalendarEvents(businessId, businessUserId);
        
        console.log(`[External Calendar] Fetched ${unifiedEvents.length} events and ${unifiedBookings.length} bookings`);
        
        // Combine all events
        const allEvents: CalendarEventType[] = [...unifiedEvents, ...unifiedBookings];
        
        // Triple validation to ensure no deleted events
        const validEvents = allEvents.filter(event => !event.deleted_at);
        
        if (validEvents.length !== allEvents.length) {
          console.warn(`[External Calendar] Filtered out ${allEvents.length - validEvents.length} deleted events`);
        }
        
        console.log(`[External Calendar] Final events to display: ${validEvents.length}`);
        
        // Update state with fresh events
        setEvents(validEvents);
        setLastSyncTime(Date.now());
        setLoadingError(null);
        
      } catch (error) {
        console.error("Exception in ExternalCalendar.fetchAllEvents:", error);
        setLoadingError("Failed to load calendar events");
        
        toast({
          title: t("common.error"),
          description: "Failed to sync calendar events",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we have both business ID and user ID
    if (businessId && businessUserId) {
      console.log("[External Calendar] Initiating aggressive sync");
      fetchAllEvents();
      
      // Aggressive polling every 1 second for immediate sync
      const intervalId = setInterval(() => {
        console.log("[External Calendar] Aggressive polling - fetching fresh data");
        fetchAllEvents();
      }, 1000);
      
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [businessId, businessUserId, toast, t, retryCount]);

  // Enhanced real-time subscription for immediate synchronization
  useEffect(() => {
    if (!businessId || !businessUserId) return;

    console.log("[External Calendar] Setting up enhanced real-time subscription");

    // Subscribe to changes in events table with immediate response
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
          console.log('[External Calendar] Events table changed (immediate sync):', payload);
          
          // Immediate response - clear cache and trigger refetch
          clearCalendarCache();
          broadcastCalendarChange();
          setRetryCount(prev => prev + 1);
          setLastSyncTime(Date.now());
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
          console.log('[External Calendar] Booking requests table changed (immediate sync):', payload);
          
          // Immediate response - clear cache and trigger refetch
          clearCalendarCache();
          broadcastCalendarChange();
          setRetryCount(prev => prev + 1);
          setLastSyncTime(Date.now());
        }
      )
      .subscribe();

    return () => {
      console.log("[External Calendar] Cleaning up real-time subscriptions");
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [businessId, businessUserId]);

  // Listen for cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = () => {
      console.log("[External Calendar] Storage changed - triggering sync");
      setRetryCount(prev => prev + 1);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("[External Calendar] Tab became visible - triggering sync");
        setRetryCount(prev => prev + 1);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!businessId) {
    return (
      <Card className="min-h-[calc(100vh-12rem)]">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No business selected</p>
        </CardContent>
      </Card>
    );
  }
  
  console.log("[ExternalCalendar] Rendering with events:", events.length, "Last sync:", new Date(lastSyncTime).toLocaleTimeString());
  
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
                Force Sync
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
