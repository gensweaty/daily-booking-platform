
import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [businessUserId, setBusinessUserId] = useState<string | null>(null);

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

  // Step 2: Fetch events once we have the business user ID
  useEffect(() => {
    const fetchAllEvents = async () => {
      if (!businessId || !businessUserId) return;
      
      setIsLoading(true);
      console.log("[External Calendar] Starting to fetch events for business user:", businessUserId);
      
      try {
        // Fetch regular events
        const { data: eventData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessUserId);
        
        if (eventsError) {
          console.error("Error fetching events:", eventsError);
          throw eventsError;
        }
        
        console.log(`[External Calendar] Fetched ${eventData?.length || 0} events for user ${businessUserId}`);
        
        // Log first event for debugging if available
        if (eventData && eventData.length > 0) {
          console.log("Sample event data:", JSON.stringify(eventData[0]));
        }
        
        // Fetch approved booking requests
        const { data: bookingData, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'approved');
          
        if (bookingsError) {
          console.error("Error fetching booking requests:", bookingsError);
          throw bookingsError;
        }
        
        console.log(`[External Calendar] Fetched ${bookingData?.length || 0} approved booking requests`);
        
        // Convert booking requests to calendar events
        const bookingEvents: CalendarEventType[] = (bookingData || []).map(booking => ({
          id: booking.id,
          title: booking.title || 'Booking',
          start_date: booking.start_date,
          end_date: booking.end_date,
          type: 'booking_request',
          created_at: booking.created_at || new Date().toISOString(),
          user_id: booking.user_id || '',
          requester_name: booking.requester_name || '',
          requester_email: booking.requester_email || '',
        }));
        
        // Combine both types of events
        const allEvents: CalendarEventType[] = [
          ...(eventData || []).map(event => ({
            ...event,
            // Ensure all required fields are present
            type: event.type || 'event'
          })),
          ...bookingEvents
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
        
        // Update state with fetched events
        setEvents(validEvents);
      } catch (error) {
        console.error("Exception in ExternalCalendar.fetchAllEvents:", error);
        toast({
          title: "Error loading events",
          description: "Failed to load calendar events. Please try again later.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we have both IDs
    if (businessId && businessUserId) {
      console.log("[External Calendar] Have both business ID and user ID, fetching events");
      fetchAllEvents();
      
      // Set up polling to refresh data
      const intervalId = setInterval(fetchAllEvents, 30000);
      return () => {
        clearInterval(intervalId);
      };
    } else if (businessId && !businessUserId) {
      console.log("[External Calendar] Have business ID but waiting for user ID");
    }
  }, [businessId, businessUserId, toast]);

  if (!businessId) {
    return (
      <Card className="min-h-[calc(100vh-12rem)]">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No business selected</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
      <CardContent className="p-0">
        <div className="px-6 pt-6 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <span className="ml-2 text-primary">Loading calendar events...</span>
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
