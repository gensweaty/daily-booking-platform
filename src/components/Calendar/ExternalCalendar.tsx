
import { useState, useEffect } from "react";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { CalendarView } from "./CalendarView";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

// Add props interface to ensure correct typing
interface ExternalCalendarProps {
  businessId: string;
  loading?: boolean;
  events?: CalendarEventType[];
  bookings?: any[];
}

export const ExternalCalendar = ({ businessId, loading: propLoading, events: propEvents, bookings: propBookings }: ExternalCalendarProps) => {
  const [date, setDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<CalendarViewType>("month");
  // Correctly initialize as boolean with default value
  const [isLoading, setIsLoading] = useState<boolean>(propLoading !== undefined ? propLoading : true);
  const [events, setEvents] = useState<CalendarEventType[]>(propEvents || []);
  const [bookings, setBookings] = useState<any[]>(propBookings || []);
  
  // Fetch events and bookings if not provided as props
  useEffect(() => {
    if (propEvents && propBookings) {
      setEvents(propEvents);
      setBookings(propBookings);
      setIsLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch public events for this business
        const { data: eventsData, error: eventsError } = await supabase
          .rpc('get_public_events_for_business', { business_id: businessId });
          
        if (eventsError) {
          console.error("Error fetching events:", eventsError);
        }
        
        // Fetch approved bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('booking_requests')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'approved');
          
        if (bookingsError) {
          console.error("Error fetching bookings:", bookingsError);
        }
        
        setEvents(eventsData || []);
        setBookings(bookingsData || []);
      } catch (error) {
        console.error("Error in data fetching:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [businessId, propEvents, propBookings, propLoading]);
  
  // Transform bookings to match CalendarEventType format for display
  const transformedBookings = bookings.map((booking) => {
    return {
      id: booking.id,
      title: booking.title,
      start_date: booking.start_date,
      end_date: booking.end_date,
      created_at: booking.created_at,
      user_id: '',
      type: 'booking_request'
    } as CalendarEventType;
  });
  
  // Combine events and transformed bookings
  const allEvents = [...events, ...transformedBookings];
  
  useEffect(() => {
    console.log(`ExternalCalendar: Loading calendar for business ID ${businessId}`);
    console.log(`ExternalCalendar: Found ${events.length} events and ${bookings.length} bookings`);
  }, [businessId, events, bookings]);

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-32" />
          <div className="flex space-x-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
        <h2 className="text-2xl font-bold">
          {format(date, "MMMM yyyy")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView("month")}
            className={currentView === "month" ? "bg-primary text-primary-foreground" : ""}
          >
            Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView("week")}
            className={currentView === "week" ? "bg-primary text-primary-foreground" : ""}
          >
            Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView("day")}
            className={currentView === "day" ? "bg-primary text-primary-foreground" : ""}
          >
            Day
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <ShadcnCalendar
                mode="single"
                selected={date}
                onSelect={(newDate) => newDate && setDate(newDate)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow">
        <CalendarView
          date={date}
          selectedView={currentView}
          events={allEvents}
          onSelectEvent={(event) => {
            // Read-only calendar, no action on event click
            console.log("Event clicked:", event);
          }}
          onSelectDate={(date) => {
            // Read-only calendar, no action on date click
            console.log("Date clicked:", date);
          }}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <h3 className="text-xl font-semibold">Upcoming Availability</h3>
        {allEvents.length === 0 ? (
          <p className="text-muted-foreground">No upcoming events found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allEvents
              .filter(event => new Date(event.start_date) >= new Date())
              .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
              .slice(0, 6)
              .map(event => (
                <div key={event.id} className="bg-background border rounded-lg p-4">
                  <div className="font-semibold">{event.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(event.start_date), "PPP")}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(event.start_date), "h:mm a")} - {format(new Date(event.end_date), "h:mm a")}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
