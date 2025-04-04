
import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { getPublicCalendarEvents } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventDialog } from "./EventDialog";

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [businessUserId, setBusinessUserId] = useState<string | null>(null);
  const { t } = useLanguage();
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [selectedBookingDate, setSelectedBookingDate] = useState<Date | null>(null);

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
            requester_phone: booking.requester_phone || '',
            description: booking.description || '',
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
        
        // Update state with fetched events
        setEvents(uniqueEvents);
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

  const handleDayClick = (date: Date, hour?: number) => {
    console.log("[ExternalCalendar] Day clicked:", date, "hour:", hour);
    setSelectedBookingDate(date);
    setIsBookingDialogOpen(true);
  };

  const handleBookingSubmit = async (data: Partial<CalendarEventType>) => {
    try {
      console.log("[External Calendar] Creating booking request:", data);
      
      const { data: bookingData, error } = await supabase
        .from('booking_requests')
        .insert({
          business_id: businessId,
          title: data.title,
          requester_name: data.user_surname,
          requester_email: data.social_network_link,
          requester_phone: data.user_number,
          description: data.event_notes,
          start_date: data.start_date,
          end_date: data.end_date,
          status: 'pending',
        })
        .select()
        .single();
        
      if (error) throw error;
      
      toast({
        title: t("booking.requestSubmitted"),
        description: t("booking.requestSubmittedDescription"),
      });
      
      return bookingData;
    } catch (error: any) {
      console.error("[External Calendar] Error creating booking request:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.error"),
        variant: "destructive",
      });
      throw error;
    }
  };

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
            onDayClick={handleDayClick}
          />
        </div>
      </CardContent>

      {selectedBookingDate && (
        <EventDialog
          open={isBookingDialogOpen}
          onOpenChange={setIsBookingDialogOpen}
          selectedDate={selectedBookingDate}
          onSubmit={handleBookingSubmit}
          isBookingRequest={true}
        />
      )}
    </Card>
  );
};
