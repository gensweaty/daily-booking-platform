
import React, { useState, useEffect } from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { EventDialog } from "./EventDialog";
import { useEventDialog } from "./hooks/useEventDialog";

interface CalendarProps {
  isExternalCalendar?: boolean;
  businessId?: string;
  businessUserId?: string;
  allowBookingRequests?: boolean;
  directEvents?: CalendarEventType[];
  fetchedEvents?: CalendarEventType[];
  onEventCreate?: (event: Partial<CalendarEventType>) => Promise<void>;
  onEventUpdate?: (id: string, event: Partial<CalendarEventType>) => Promise<void>;
  onEventDelete?: (id: string) => Promise<void>;
  view?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  isExternalCalendar = false,
  businessId = "",
  businessUserId = "",
  allowBookingRequests = false,
  directEvents = [],
  fetchedEvents = [],
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  view = "month",
  onViewChange,
}) => {
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const eventDialog = useEventDialog();
  
  useEffect(() => {
    // Combine direct events and fetched events
    const combinedEvents = [...(directEvents || []), ...(fetchedEvents || [])];
    setEvents(combinedEvents);
  }, [directEvents, fetchedEvents]);

  // Debug logs for troubleshooting
  console.log("[Calendar] Rendering with props:", { 
    isExternalCalendar, 
    businessId,
    businessUserId, 
    allowBookingRequests,
    directEvents: directEvents?.length || 0,
    fetchedEvents: fetchedEvents?.length || 0,
    eventsCount: events?.length || 0,
    view
  });
  
  if (events?.length > 0) {
    console.log("[Calendar] First event:", events[0]);
  }

  return (
    <div className="w-full calendar-container">
      <CalendarHeader 
        view={view} 
        onViewChange={onViewChange}
        isExternalCalendar={isExternalCalendar}
      />
      <CalendarGrid 
        events={events}
        view={view}
        onEventClick={eventDialog.openForEdit}
        onDateClick={eventDialog.openForCreate}
        isExternalCalendar={isExternalCalendar}
        allowBookingRequests={allowBookingRequests}
      />
      <EventDialog 
        {...eventDialog}
        onEventCreate={onEventCreate}
        onEventUpdate={onEventUpdate}
        onEventDelete={onEventDelete}
        isExternalCalendar={isExternalCalendar}
        businessId={businessId}
      />
    </div>
  );
};
