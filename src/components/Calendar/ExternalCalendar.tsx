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
  const { t } = useLanguage();

  // Diagnostic logging for businessId
  useEffect(() => {
    console.log("External Calendar mounted with business ID:", businessId);
  }, [businessId]);

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
          return;
        }
        
        if (data?.user_id) {
          console.log("[External Calendar] Found business user ID:", data.user_id);
          setBusinessUserId(data.user_id);
        } else {
          console.error("No user ID found for business:", businessId);
        }
      } catch (error) {
        console.error("Exception fetching business user ID:", error);
      }
    };
    
    getBusinessUserId();
  }, [businessId]);

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
        
        // Map events to the correct format
        const formattedApiEvents = (apiEvents || []).map(event => ({
          ...event,
          type: event.type || 'event'
        }));
        
        // Map bookings to the correct format
        const formattedBookings = (approvedBookings || []).map(booking => ({
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
          file_path: booking.file_path || null,
          filename: booking.filename || null
        }));
        
        // Deduplicate events by creating a map with a unique key for each time slot
        const deduplicateEvents = (eventsArray: CalendarEventType[], bookingsArray: CalendarEventType[]) => {
          const eventMap = new Map<string, CalendarEventType>();
          
          // First add all regular events to the map
          eventsArray.forEach(event => {
            const key = `${event.start_date}|${event.end_date}|${event.title}`;
            eventMap.set(key, event);
          });
          
          // Then process booking events - check if we already have a regular event for this slot
          bookingsArray.forEach(booking => {
            const key = `${booking.start_date}|${booking.end_date}|${booking.title}`;
            
            // If we already have an event with this key, check which one to keep
            if (eventMap.has(key)) {
              const existingEvent = eventMap.get(key)!;
              
              // Prefer the booking event if it has a file attached but the regular event doesn't
              if (booking.file_path && !existingEvent.file_path) {
                eventMap.set(key, booking);
              }
              // Or if both have files or neither has files, prefer the booking event which has more fields populated
              else if ((booking.requester_name && !existingEvent.user_surname) || 
                      (booking.requester_phone && !existingEvent.user_number)) {
                eventMap.set(key, booking);
              }
            } else {
              // If no event exists with this key, add the booking
              eventMap.set(key, booking);
            }
          });
          
          return Array.from(eventMap.values());
        };
        
        // Deduplicate events
        const dedupedEvents = deduplicateEvents(formattedApiEvents, formattedBookings);
        
        // Validate all events have proper dates
        const validEvents = dedupedEvents.filter(event => {
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
        
        if (validEvents.length !== dedupedEvents.length) {
          console.warn(`Filtered out ${dedupedEvents.length - validEvents.length} events with invalid dates`);
        }
        
        console.log(`[External Calendar] Final unique events: ${validEvents.length}`);
        
        // Update state with fetched events
        setEvents(validEvents);
      } catch (error) {
        console.error("Exception in ExternalCalendar.fetchAllEvents:", error);
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
      
      // Set up polling to refresh data every 15 seconds
      const intervalId = setInterval(fetchAllEvents, 15000);
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [businessId, toast, t]);

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
