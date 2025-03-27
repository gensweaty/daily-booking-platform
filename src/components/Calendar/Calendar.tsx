
import { useState, useEffect } from "react";
import { CalendarView } from "./CalendarView";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { EventDialog } from "./EventDialog";
import { EventRequestDialog } from "./EventRequestDialog";
import { useEventRequests } from "@/hooks/useEventRequests";
import { useBusiness } from "@/hooks/useBusiness";
import { EventRequest } from "@/lib/types/business";

interface CalendarProps {
  defaultView?: CalendarViewType;
  onDateClick?: (date: Date) => void;
  publicMode?: boolean;
}

export const Calendar = ({
  defaultView = "month",
  onDateClick,
  publicMode = false
}: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [visibleDate, setVisibleDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [selectedEventRequest, setSelectedEventRequest] = useState<EventRequest | null>(null);
  const { events, createEvent, updateEvent, deleteEvent, isLoading } = useCalendarEvents();
  const { business } = useBusiness();
  const { eventRequests, pendingRequests } = useEventRequests(business?.id);
  
  // Make global events available to other components for time slot checking
  useEffect(() => {
    if (events) {
      (window as any).__CALENDAR_EVENTS__ = events;
    }
  }, [events]);
  
  const handleDateSelect = (date: Date) => {
    if (onDateClick) {
      onDateClick(date);
    } else {
      setSelectedDate(date);
      setIsNewEventDialogOpen(true);
    }
  };
  
  const handleEventSelect = (event: CalendarEventType) => {
    setSelectedEvent(event);
  };
  
  const handleEventRequestSelect = (request: EventRequest) => {
    setSelectedEventRequest(request);
  };
  
  const handleEventCreate = async (data: Partial<CalendarEventType>) => {
    return await createEvent(data);
  };
  
  const handleEventUpdate = async (data: Partial<CalendarEventType>) => {
    if (!selectedEvent) return null;
    return await updateEvent({ id: selectedEvent.id, updates: data });
  };
  
  const handleEventDelete = async () => {
    if (!selectedEvent) return;
    await deleteEvent(selectedEvent.id);
    setSelectedEvent(null);
  };
  
  // Combine regular events and pending event requests for display
  const allEvents = [...(events || [])];
  
  // Add pending event requests if not in public mode
  if (!publicMode && pendingRequests) {
    pendingRequests.forEach(request => {
      allEvents.push({
        id: request.id,
        title: `[REQUEST] ${request.title}`,
        start_date: request.start_date,
        end_date: request.end_date,
        type: request.type as any || 'private_party',
        created_at: request.created_at,
        user_surname: request.user_surname,
        user_number: request.user_number,
        social_network_link: request.social_network_link,
        event_notes: request.event_notes,
        payment_status: request.payment_status,
        payment_amount: request.payment_amount,
        // Add a special property to identify requests
        __isRequest: true
      } as any);
    });
  }
  
  return (
    <div className="flex flex-col h-full">
      <CalendarHeader
        view={view}
        onViewChange={setView}
        visibleDate={visibleDate}
        onVisibleDateChange={setVisibleDate}
        onAddEvent={publicMode ? undefined : () => setIsNewEventDialogOpen(true)}
      />
      
      <div className="flex-1 overflow-auto">
        <CalendarView
          view={view}
          events={allEvents}
          visibleDate={visibleDate}
          onDateSelect={handleDateSelect}
          onEventSelect={(event) => {
            // Check if the event is actually a request
            if ((event as any).__isRequest) {
              const request = pendingRequests?.find(req => req.id === event.id);
              if (request) {
                handleEventRequestSelect(request);
              }
            } else {
              handleEventSelect(event);
            }
          }}
          isLoading={isLoading}
          publicMode={publicMode}
        />
      </div>
      
      {isNewEventDialogOpen && (
        <EventDialog
          open={isNewEventDialogOpen}
          onOpenChange={setIsNewEventDialogOpen}
          selectedDate={selectedDate}
          onSubmit={handleEventCreate}
        />
      )}
      
      {selectedEvent && (
        <EventDialog
          open={!!selectedEvent}
          onOpenChange={() => setSelectedEvent(null)}
          selectedDate={new Date(selectedEvent.start_date)}
          event={selectedEvent}
          onSubmit={handleEventUpdate}
          onDelete={handleEventDelete}
        />
      )}
      
      {selectedEventRequest && (
        <EventRequestDialog
          open={!!selectedEventRequest}
          onOpenChange={() => setSelectedEventRequest(null)}
          eventRequest={selectedEventRequest}
        />
      )}
    </div>
  );
};
