
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

  // Function to fetch events for the business
  const fetchAllEvents = async () => {
    console.log("ExternalCalendar: Starting direct fetch for business ID:", businessId);
    setIsLoading(true);
    
    try {
      // First, find the user_id for this business
      const { data: businessProfile, error: businessError } = await supabase
        .from("business_profiles")
        .select("user_id")
        .eq("id", businessId)
        .single();
      
      if (businessError) {
        console.error("Error fetching business profile:", businessError);
        throw businessError;
      }
      
      if (!businessProfile?.user_id) {
        console.error("No user_id found for business:", businessId);
        throw new Error("Business user not found");
      }
      
      console.log(`Found business owner user_id: ${businessProfile.user_id}`);
      
      // Fetch all events for this business owner
      const { data: eventData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', businessProfile.user_id);
      
      if (eventsError) {
        console.error("Error fetching events:", eventsError);
        throw eventsError;
      }
      
      console.log(`Fetched ${eventData?.length || 0} events for user ${businessProfile.user_id}`);
      
      // Fetch all approved booking requests for this business
      const { data: bookingData, error: bookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved');
        
      if (bookingsError) {
        console.error("Error fetching booking requests:", bookingsError);
        throw bookingsError;
      }
      
      console.log(`Fetched ${bookingData?.length || 0} approved booking requests for business ${businessId}`);
      
      // Convert booking requests to calendar events format
      const bookingEvents = (bookingData || []).map(booking => ({
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
      
      // Create proper CalendarEventType objects from regular events
      const calendarEvents = (eventData || []).map(event => ({
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        type: event.type || 'event',
        created_at: event.created_at,
        user_id: event.user_id,
        user_surname: event.user_surname,
        user_number: event.user_number,
        social_network_link: event.social_network_link,
        event_notes: event.event_notes,
        payment_status: event.payment_status,
        payment_amount: event.payment_amount,
      }));
      
      // Combine both types of events
      const allEvents = [...calendarEvents, ...bookingEvents];
      console.log(`Total combined events: ${allEvents.length}`);
      
      if (allEvents.length > 0) {
        console.log("Sample event:", allEvents[0]);
      }
      
      // Update state with fetched events
      setEvents(allEvents);
    } catch (error) {
      console.error("Exception in ExternalCalendar.fetchAllEvents:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading events.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch events initially and set up polling
  useEffect(() => {
    if (!businessId) {
      console.error("No businessId provided to ExternalCalendar");
      setIsLoading(false);
      return;
    }

    console.log("ExternalCalendar: Initial fetch for business ID:", businessId);
    fetchAllEvents();
    
    // Poll for updates every 15 seconds
    const intervalId = setInterval(fetchAllEvents, 15000);
    
    return () => {
      clearInterval(intervalId);
      console.log("ExternalCalendar: Cleanup, cleared polling interval");
    };
  }, [businessId]);

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
            showAllEvents={true}
            allowBookingRequests={true}
            directEvents={events}
          />
        </div>
      </CardContent>
    </Card>
  );
};
