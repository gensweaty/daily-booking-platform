
import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { getPublicCalendarEvents } from "@/lib/api";

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Function to fetch events for the business
  const fetchAllEvents = async () => {
    console.log("ExternalCalendar: Starting fetchAllEvents for business ID:", businessId);
    setIsLoading(true);
    
    try {
      // Use our API helper function to get events and approved bookings
      const { events: userEvents, bookings: approvedBookings } = await getPublicCalendarEvents(businessId);
      
      // Convert booking requests to calendar events format
      const bookingEvents = (approvedBookings || []).map(booking => ({
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
      const allEvents = [...(userEvents || []), ...bookingEvents];
      console.log(`ExternalCalendar: Total combined events: ${allEvents.length}`);
      
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
    
    // Poll for updates every 30 seconds
    const intervalId = setInterval(fetchAllEvents, 30000);
    
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
