
import { useState, useEffect } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  startOfDay,
} from "date-fns";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TimeIndicator } from "./TimeIndicator";
import { useEventDialog } from "./hooks/useEventDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getAllBusinessEvents } from "@/lib/api";

interface CalendarProps {
  defaultView?: CalendarViewType;
  publicMode?: boolean;
  externalEvents?: CalendarEventType[];
  businessId?: string;
}

export const Calendar = ({ 
  defaultView = "week", 
  publicMode = false,
  externalEvents,
  businessId
}: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent, createEventRequest } = useCalendarEvents();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Log and debug events
  useEffect(() => {
    if (publicMode) {
      console.log("[Calendar] Public mode with external events:", externalEvents?.length || 0, "events");
      if (externalEvents && externalEvents.length > 0) {
        console.log("[Calendar] First few external events:", 
          externalEvents.slice(0, 3).map(e => ({ 
            id: e.id, 
            title: e.title, 
            start: e.start_date,
            type: e.type || 'standard'
          }))
        );
      }
    } else {
      console.log("[Calendar] Private mode with internal events:", events?.length || 0, "events");
      if (events && events.length > 0) {
        console.log("[Calendar] First few internal events:", 
          events.slice(0, 3).map(e => ({ 
            id: e.id, 
            title: e.title, 
            start: e.start_date,
            type: e.type || 'standard' 
          }))
        );
      }
    }
  }, [publicMode, externalEvents, events]);

  // Force refresh data when businessId changes or component mounts
  useEffect(() => {
    if (businessId) {
      console.log("[Calendar] Invalidating queries for business:", businessId);
      queryClient.invalidateQueries({ queryKey: ['direct-business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['approved-event-requests', businessId] });
      queryClient.invalidateQueries({ queryKey: ['api-combined-events', businessId] });
      
      if (publicMode) {
        const fetchDirectData = async () => {
          try {
            console.log("[Calendar] Direct API fetch for fresh data, business:", businessId);
            const freshEvents = await getAllBusinessEvents(businessId);
            console.log(`[Calendar] Direct fetch retrieved ${freshEvents.length} events`);
          } catch (err) {
            console.error("[Calendar] Error fetching direct business events:", err);
          }
        };
        
        fetchDirectData();
        
        // Set up periodic refresh
        const intervalId = setInterval(() => {
          console.log("[Calendar] Periodic refresh for business data");
          fetchDirectData();
        }, 30000); // Refresh every 30 seconds
        
        return () => clearInterval(intervalId);
      }
    }
  }, [businessId, queryClient, publicMode]);

  const {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedDate: dialogSelectedDate,
    setSelectedDate: setDialogSelectedDate,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({
    createEvent: async (data) => {
      try {
        if (publicMode && businessId) {
          console.log("[Calendar] Creating event request with business_id:", businessId);
          const requestData = {
            ...data,
            business_id: businessId,
            status: 'pending'
          };
          
          const result = await createEventRequest(requestData);
          
          toast({
            title: "Request Sent",
            description: "Your booking request has been sent to the business owner for approval.",
          });
          
          queryClient.invalidateQueries({ queryKey: ['direct-business-events', businessId] });
          queryClient.invalidateQueries({ queryKey: ['all-business-events', businessId] });
          queryClient.invalidateQueries({ queryKey: ['all-business-events'] });
          
          return result;
        } else {
          console.log("[Calendar] Creating regular event:", 
            businessId ? "with business_id: " + businessId : "without business_id");
          
          const eventData = { ...data };
          if (businessId) {
            eventData.business_id = businessId;
          }
          
          const result = await createEvent(eventData);
          
          if (eventData.business_id) {
            queryClient.invalidateQueries({ queryKey: ['direct-business-events', eventData.business_id] });
            queryClient.invalidateQueries({ queryKey: ['all-business-events', eventData.business_id] });
          }
          queryClient.invalidateQueries({ queryKey: ['all-business-events'] });
          
          return result;
        }
      } catch (error: any) {
        console.error("[Calendar] Error creating event:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to create event",
          variant: "destructive",
        });
        throw error;
      }
    },
    updateEvent: async (data) => {
      if (!selectedEvent) throw new Error("No event selected");
      
      if (!data.business_id && selectedEvent.business_id) {
        data.business_id = selectedEvent.business_id;
      }
      
      if (!data.business_id && businessId) {
        data.business_id = businessId;
      }
      
      try {
        const result = await updateEvent(data);
        
        if (businessId || selectedEvent.business_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['direct-business-events', businessId || selectedEvent.business_id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['all-business-events', businessId || selectedEvent.business_id] 
          });
        }
        queryClient.invalidateQueries({ queryKey: ['all-business-events'] });
        
        return result;
      } catch (error: any) {
        console.error("[Calendar] Error updating event:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to update event",
          variant: "destructive",
        });
        throw error;
      }
    },
    deleteEvent: async (id) => {
      try {
        if (businessId || selectedEvent?.business_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['direct-business-events', businessId || selectedEvent?.business_id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['all-business-events', businessId || selectedEvent?.business_id] 
          });
        }
        
        await deleteEvent(id);
        queryClient.invalidateQueries({ queryKey: ['all-business-events'] });
      } catch (error: any) {
        console.error("[Calendar] Error deleting event:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to delete event",
          variant: "destructive",
        });
        throw error;
      }
    }
  });

  if (!publicMode && !user) {
    navigate("/signin");
    return null;
  }

  const getDaysForView = () => {
    switch (view) {
      case "month": {
        const monthStart = startOfMonth(selectedDate);
        const firstWeekStart = startOfWeek(monthStart);
        const monthEnd = endOfMonth(selectedDate);
        return eachDayOfInterval({
          start: firstWeekStart,
          end: monthEnd,
        });
      }
      case "week":
        return eachDayOfInterval({
          start: startOfWeek(selectedDate),
          end: endOfWeek(selectedDate),
        });
      case "day":
        return [startOfDay(selectedDate)];
    }
  };

  const handlePrevious = () => {
    switch (view) {
      case "month":
        setSelectedDate(subMonths(selectedDate, 1));
        break;
      case "week":
        setSelectedDate(addDays(selectedDate, -7));
        break;
      case "day":
        setSelectedDate(addDays(selectedDate, -1));
        break;
    }
  };

  const handleNext = () => {
    switch (view) {
      case "month":
        setSelectedDate(addMonths(selectedDate, 1));
        break;
      case "week":
        setSelectedDate(addDays(selectedDate, 7));
        break;
      case "day":
        setSelectedDate(addDays(selectedDate, 1));
        break;
    }
  };

  const handleCalendarDayClick = (date: Date, hour?: number) => {
    const clickedDate = new Date(date);
    clickedDate.setHours(hour || 9, 0, 0, 0);
    
    setDialogSelectedDate(clickedDate);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleAddEventClick = () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    
    setDialogSelectedDate(now);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  let displayEvents: CalendarEventType[] = [];
  
  if (publicMode && Array.isArray(externalEvents) && externalEvents.length > 0) {
    displayEvents = externalEvents;
    console.log(`[Calendar] Using ${displayEvents.length} external events in public mode`);
  } else if (!publicMode && Array.isArray(events) && events.length > 0) {
    displayEvents = events;
    console.log(`[Calendar] Using ${displayEvents.length} internal events in private mode`);
  }

  if (displayEvents.length > 0) {
    console.log("[Calendar] Events to display:", displayEvents.slice(0, 3).map(e => ({ 
      id: e.id,
      title: e.title,
      start: e.start_date,
      end: e.end_date
    })));
  }

  if (error && !publicMode) {
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

  if (isLoading && !publicMode && !externalEvents) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-full bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <CalendarHeader
        selectedDate={selectedDate}
        view={view}
        onViewChange={setView}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onAddEvent={!publicMode ? handleAddEventClick : undefined}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className="flex-1">
          <CalendarView
            days={getDaysForView()}
            events={displayEvents}
            selectedDate={selectedDate}
            view={view}
            onDayClick={handleCalendarDayClick}
            onEventClick={!publicMode ? setSelectedEvent : () => {}}
            publicMode={publicMode}
          />
        </div>
      </div>

      {!publicMode && (
        <>
          <EventDialog
            key={`new-${dialogSelectedDate?.getTime()}`}
            open={isNewEventDialogOpen}
            onOpenChange={setIsNewEventDialogOpen}
            selectedDate={dialogSelectedDate}
            onSubmit={handleCreateEvent}
            businessId={businessId}
          />

          {selectedEvent && (
            <EventDialog
              key={`edit-${selectedEvent.id}`}
              open={!!selectedEvent}
              onOpenChange={() => setSelectedEvent(null)}
              selectedDate={new Date(selectedEvent.start_date)}
              event={selectedEvent}
              onSubmit={handleUpdateEvent}
              onDelete={handleDeleteEvent}
              businessId={businessId || selectedEvent.business_id}
            />
          )}
        </>
      )}

      {publicMode && isNewEventDialogOpen && dialogSelectedDate && (
        <EventDialog
          key={`public-${dialogSelectedDate?.getTime()}`}
          open={isNewEventDialogOpen}
          onOpenChange={setIsNewEventDialogOpen}
          selectedDate={dialogSelectedDate}
          onSubmit={handleCreateEvent}
          businessId={businessId}
        />
      )}
    </div>
  );
};
