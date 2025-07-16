
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

  useEffect(() => {
    console.log("[External Calendar] Mounted with business ID:", businessId);
    setLoadingError(null);
    clearCalendarCache();
  }, [businessId]);

  // Retry mechanism
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

  // Get the business user ID
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

  // Fetch events using database function for external calendar
  useEffect(() => {
    const fetchAllEvents = async () => {
      if (!businessId || !businessUserId) return;
      
      setIsLoading(true);
      console.log("[External Calendar] Starting to fetch events for business ID:", businessId, "user ID:", businessUserId);
      
      try {
        // Clear cache before fetching to ensure fresh data
        clearCalendarCache();
        
        // Use the database function directly for external calendar to ensure proper filtering
        console.log("[External Calendar] Using database function for external calendar");
        const { data: publicEvents, error: publicError } = await supabase
          .rpc('get_public_calendar_events', { business_id_param: businessId });

        if (publicError) {
          console.error('[External Calendar] Error fetching public events:', publicError);
          setLoadingError("Failed to load calendar events");
          return;
        }

        console.log(`[External Calendar] Fetched ${publicEvents?.length || 0} public events from database function`);

        // Convert to CalendarEventType format
        const formattedEvents: CalendarEventType[] = (publicEvents || []).map(event => ({
          id: event.event_id,
          title: event.event_title,
          start_date: event.event_start_date,
          end_date: event.event_end_date,
          user_id: event.event_user_id || '',
          user_surname: event.event_user_surname,
          user_number: event.event_user_number,
          social_network_link: event.event_social_network_link,
          event_notes: event.event_notes,
          payment_status: event.event_payment_status,
          payment_amount: event.event_payment_amount,
          type: event.event_type || 'event',
          language: event.event_language,
          created_at: event.event_created_at || new Date().toISOString(),
          deleted_at: event.event_deleted_at
        }));

        // Final validation - these should already be filtered but double-check
        const validEvents = formattedEvents.filter(event => !event.deleted_at);
        
        if (validEvents.length !== formattedEvents.length) {
          console.warn(`[External Calendar] Filtered out ${formattedEvents.length - validEvents.length} deleted events`);
        }
        
        console.log(`[External Calendar] Final events to display: ${validEvents.length}`);
        console.log('[External Calendar] Event details:', validEvents.map(e => ({ 
          id: e.id, 
          title: e.title, 
          start: e.start_date, 
          type: e.type,
          deleted_at: e.deleted_at
        })));
        
        setEvents(validEvents);
        setLoadingError(null);
      } catch (error) {
        console.error("Exception in ExternalCalendar.fetchAllEvents:", error);
        setLoadingError("Failed to load calendar events");
        
        toast({
          title: t("common.error"),
          description: t("common.error"),
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (businessId && businessUserId) {
      console.log("[External Calendar] Have business ID and user ID, fetching events");
      fetchAllEvents();
      
      // Set up immediate polling for real-time sync (every 1 second for external calendar)
      const intervalId = setInterval(() => {
        console.log("[External Calendar] Polling interval triggered for external calendar");
        fetchAllEvents();
      }, 1000);
      
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [businessId, businessUserId, toast, t, retryCount]);

  // Enhanced real-time subscription for immediate sync
  useEffect(() => {
    if (!businessId || !businessUserId) return;

    console.log("[External Calendar] Setting up real-time subscription for external calendar");

    // Subscribe to changes in events table for this specific user
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
          console.log('[External Calendar] Events table changed for user:', payload);
          // Clear cache and trigger immediate refetch
          clearCalendarCache();
          setRetryCount(prev => prev + 1);
        }
      )
      .subscribe();

    // Subscribe to changes in booking_requests table for this business
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
          console.log('[External Calendar] Booking requests table changed for business:', payload);
          // Clear cache and trigger immediate refetch
          clearCalendarCache();
          setRetryCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      console.log("[External Calendar] Cleaning up real-time subscriptions");
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(bookingsChannel);
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
