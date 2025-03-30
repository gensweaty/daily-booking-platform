
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

  useEffect(() => {
    if (!businessId) {
      console.error("No businessId provided to ExternalCalendar");
      return;
    }

    const fetchEvents = async () => {
      setIsLoading(true);
      console.log("ExternalCalendar: Directly fetching events for business ID:", businessId);
      
      try {
        // First get the user_id associated with this business
        const { data: businessData, error: businessError } = await supabase
          .from("business_profiles")
          .select("user_id")
          .eq("id", businessId)
          .single();
          
        if (businessError) {
          console.error("Error fetching business:", businessError);
          setIsLoading(false);
          toast({
            title: "Error loading calendar",
            description: "Could not find business data.",
            variant: "destructive"
          });
          return;
        }
        
        if (!businessData?.user_id) {
          console.error("No user_id found for business:", businessId);
          setIsLoading(false);
          toast({
            title: "Error loading calendar",
            description: "Could not find business owner data.",
            variant: "destructive"
          });
          return;
        }

        console.log("ExternalCalendar: Found business user_id:", businessData.user_id);
        
        // Now fetch events for this user_id
        const { data: eventData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', businessData.user_id);

        if (eventsError) {
          console.error("Error fetching events:", eventsError);
          setIsLoading(false);
          toast({
            title: "Error loading events",
            description: "Could not fetch calendar events.",
            variant: "destructive"
          });
          return;
        }

        console.log(`ExternalCalendar: Fetched ${eventData?.length || 0} events:`, eventData);
        
        // Also fetch approved booking requests
        const { data: bookingData, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'approved');
          
        if (bookingsError) {
          console.error("Error fetching booking requests:", bookingsError);
          // Continue with just the events data
        }
        
        // Convert booking requests to calendar events
        const bookingEvents = (bookingData || []).map(booking => ({
          id: booking.id,
          title: booking.title,
          start_date: booking.start_date,
          end_date: booking.end_date,
          type: 'booking_request',
          created_at: booking.created_at || new Date().toISOString(),
          user_id: booking.user_id || businessData.user_id,
          requester_name: booking.requester_name,
          requester_email: booking.requester_email,
        }));
        
        console.log(`ExternalCalendar: Added ${bookingEvents.length} booking events`);
        
        // Combine regular events and booking events
        const allEvents = [...(eventData || []), ...bookingEvents];
        console.log(`ExternalCalendar: Total events to display: ${allEvents.length}`);
        
        setEvents(allEvents);
      } catch (err) {
        console.error("Exception in ExternalCalendar.fetchEvents:", err);
        toast({
          title: "Error",
          description: "An unexpected error occurred while loading events.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
    
    // Set up a polling interval to refresh events
    const intervalId = setInterval(fetchEvents, 10000);
    return () => clearInterval(intervalId);
  }, [businessId, toast]);

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
