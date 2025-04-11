
import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { getPublicCalendarEvents } from "@/lib/api";
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
    console.log("External Calendar mounted with business ID:", businessId);
    
    // Reset error state when business ID changes
    setLoadingError(null);
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

  // Step 2: Fetch all events using the getPublicCalendarEvents API which uses our new RPC function
  useEffect(() => {
    const fetchAllEvents = async () => {
      if (!businessId) return;
      
      setIsLoading(true);
      console.log("[External Calendar] Starting to fetch events for business ID:", businessId);
      
      try {
        // Get events from the API function which includes approved bookings and user events
        // This now uses our security definer function to bypass RLS
        const { events: apiEvents, bookings: approvedBookings } = await getPublicCalendarEvents(businessId);
        
        console.log(`[External Calendar] Fetched ${apiEvents?.length || 0} API events`);
        console.log(`[External Calendar] Fetched ${approvedBookings?.length || 0} approved booking requests`);
        
        // Combine all event sources
        const allEvents: CalendarEventType[] = [
          ...(apiEvents || []).map(event => ({
            ...event,
            type: event.type || 'event'
          })),
          ...(approvedBookings || []).map(booking => ({
            id: booking.id,
            title: booking.title || 'Booking',
            start_date: booking.start_date,
            end_date: booking.end_date,
            type: 'booking_request',
            created_at: booking.created_at || new Date().toISOString(),
            user_id: booking.user_id || '',
            user_surname: booking.requester_name || '',
            user_number: booking.requester_phone || '',
            social_network_link: booking.requester_email || '',
            event_notes: booking.description || '',
            requester_name: booking.requester_name || '',
            requester_email: booking.requester_email || '',
          }))
        ];
        
        console.log(`[External Calendar] Combined ${allEvents.length} total events`);
        
        // Validate all events have proper dates
        const validEvents = allEvents.filter(event => {
          try {
            // Check if start_date and end_date are valid
            const startValid = !!new Date(event.start_date).getTime();
            const endValid = !!new Date(event.end_date).getTime();
            return startValid && endValid;
          } catch (err) {
            console.error("Invalid date in event:", event);
            return false;
          }
        });
        
        if (validEvents.length !== allEvents.length) {
          console.warn(`Filtered out ${allEvents.length - validEvents.length} events with invalid dates`);
        }
        
        // Remove duplicate events (same time slot)
        const eventMap = new Map();
        validEvents.forEach(event => {
          const key = `${event.start_date}-${event.end_date}`;
          // Prioritize booking_request type events
          if (!eventMap.has(key) || event.type === 'booking_request') {
            eventMap.set(key, event);
          }
        });
        
        const uniqueEvents = Array.from(eventMap.values());
        console.log(`[External Calendar] Final unique events: ${uniqueEvents.length}`);
        
        // Store events in session storage for recovery
        try {
          sessionStorage.setItem(`calendar_events_${businessId}`, JSON.stringify(uniqueEvents));
        } catch (e) {
          console.warn("Failed to store events in session storage:", e);
        }
        
        // Update state with fetched events
        setEvents(uniqueEvents);
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

    // Only fetch if we have the business ID
    if (businessId) {
      console.log("[External Calendar] Have business ID, fetching events");
      fetchAllEvents();
      
      // Set up polling to refresh data every 30 seconds
      const intervalId = setInterval(fetchAllEvents, 30000);
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [businessId, toast, t, retryCount]);

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
