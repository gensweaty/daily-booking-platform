import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { getUnifiedCalendarEvents, clearCalendarCache } from "@/services/calendarService";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from '@tanstack/react-query';
import { WorkingHoursConfig } from "@/types/workingHours";

interface ExternalCalendarProps {
  businessId: string;
  workingHours?: WorkingHoursConfig | null;
}

export const ExternalCalendar = ({ businessId, workingHours }: ExternalCalendarProps) => {
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const { toast } = useToast();
  const [businessUserId, setBusinessUserId] = useState<string | null>(null);
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Immediate loading optimization
  useEffect(() => {
    console.log("[External Calendar] Mounted with business ID:", businessId);
    clearCalendarCache();
    
    // Quick timeout to ensure calendar shows immediately
    const loadingTimeout = setTimeout(() => {
      console.log("[External Calendar] Quick loading timeout");
      setIsInitialLoading(false);
    }, 500);
    
    return () => clearTimeout(loadingTimeout);
  }, [businessId]);

  // Fast business user ID lookup with immediate cache check
  useEffect(() => {
    const getBusinessUserId = async () => {
      if (!businessId) {
        setIsInitialLoading(false);
        return;
      }
      
      // Check cache first for instant loading
      const cachedUserId = sessionStorage.getItem(`business_user_id_${businessId}`);
      if (cachedUserId) {
        console.log("[External Calendar] Using cached business user ID:", cachedUserId);
        setBusinessUserId(cachedUserId);
        setIsInitialLoading(false);
        return;
      }
      
      try {
        console.log("[External Calendar] Fetching business user ID for business:", businessId);
        const { data, error } = await supabase
          .from("business_profiles")
          .select("user_id")
          .eq("id", businessId)
          .maybeSingle();
        
        if (error || !data?.user_id) {
          console.error("Error fetching business user ID:", error);
          setIsInitialLoading(false);
          return;
        }
        
        console.log("[External Calendar] Found business user ID:", data.user_id);
        setBusinessUserId(data.user_id);
        sessionStorage.setItem(`business_user_id_${businessId}`, data.user_id);
      } catch (error) {
        console.error("Exception fetching business user ID:", error);
      } finally {
        setIsInitialLoading(false);
      }
    };
    
    getBusinessUserId();
  }, [businessId]);

  // Step 2: Fetch events - simplified without retry loops
  useEffect(() => {
    let isMounted = true;
    
    const fetchAllEvents = async () => {
      if (!businessId || !businessUserId) {
        console.log("[External Calendar] Missing business ID or user ID, skipping event fetch");
        return;
      }
      
      console.log("[External Calendar] Fetching events for business ID:", businessId, "user ID:", businessUserId);
      
      try {
        const { events: unifiedEvents, bookings: unifiedBookings } = await getUnifiedCalendarEvents(businessId, businessUserId);
        
        console.log(`[External Calendar] Fetched ${unifiedEvents.length} events and ${unifiedBookings.length} bookings`);
        
        // Combine all events
        const allEvents: CalendarEventType[] = [...unifiedEvents, ...unifiedBookings];
        
        // Filter out deleted events and deduplicate
        const validEvents = allEvents.filter(event => !event.deleted_at);
        const uniqueEvents = validEvents.filter((event, index, self) => 
          index === self.findIndex(e => e.id === event.id)
        );
        
        console.log(`[External Calendar] Final unique events to display: ${uniqueEvents.length}`);
        
        if (isMounted) {
          // Store events in session storage for recovery
          try {
            sessionStorage.setItem(`calendar_events_${businessId}`, JSON.stringify(uniqueEvents));
          } catch (e) {
            // Silent fail for storage issues
          }
          
          setEvents(uniqueEvents);
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
        }
      }
    };

    // Only fetch if we have both businessId and businessUserId
    if (businessId && businessUserId) {
      console.log("[External Calendar] Have business ID and user ID, fetching events");
      fetchAllEvents();
      
      // Reduced polling frequency for better performance
      const intervalId = setInterval(() => {
        fetchAllEvents();
      }, 30000);
      
      return () => {
        isMounted = false;
        clearInterval(intervalId);
      };
    }
    
    return () => {
      isMounted = false;
    };
  }, [businessId, businessUserId]);

  // Real-time subscriptions - simplified
  useEffect(() => {
    if (!businessId || !businessUserId) return;

    console.log("[External Calendar] Setting up real-time subscriptions");

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
          console.log("[External Calendar] Real-time event update detected");
          clearCalendarCache();
          queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
          queryClient.invalidateQueries({ queryKey: ['events', businessUserId] });
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
          console.log("[External Calendar] Real-time booking update detected");
          clearCalendarCache();
          queryClient.invalidateQueries({ queryKey: ['business-events', businessId] });
          queryClient.invalidateQueries({ queryKey: ['events', businessUserId] });
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
  
  console.log("[ExternalCalendar] Rendering with events:", events.length, "loading:", isInitialLoading);
  
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
            workingHours={workingHours}
          />
        </div>
      </CardContent>
    </Card>
  );
};