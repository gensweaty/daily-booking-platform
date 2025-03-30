import { useState, useEffect } from "react";
import { startOfWeek, endOfWeek, eachDayOfInterval, addDays, startOfMonth, endOfMonth, addMonths, subMonths, startOfDay } from "date-fns";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { useEventDialog } from "./useEventDialog";
import { useCalendarEvents } from "@/hooks/calendar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getAllBusinessEvents } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useCombinedEvents } from "@/hooks/useCombinedEvents";

export const useCalendar = (
  defaultView: CalendarViewType = "week",
  publicMode: boolean = false,
  externalEvents?: CalendarEventType[],
  businessId?: string,
  fromDashboard: boolean = false
) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent, createEventRequest } = useCalendarEvents();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { events: combinedEvents, isLoading: loadingCombined, refetch: refetchCombined } = 
    useCombinedEvents(businessId);

  useEffect(() => {
    if (businessId) {
      console.log("[useCalendar] Invalidating queries for business:", businessId);
      queryClient.invalidateQueries({ queryKey: ['direct-business-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['approved-event-requests', businessId] });
      queryClient.invalidateQueries({ queryKey: ['api-combined-events', businessId] });
      queryClient.invalidateQueries({ queryKey: ['all-business-events', businessId] });
      
      if (publicMode || fromDashboard) {
        const fetchDirectData = async () => {
          try {
            console.log("[useCalendar] Direct API fetch for fresh data, business:", businessId);
            const freshEvents = await getAllBusinessEvents(businessId);
            console.log(`[useCalendar] Direct fetch retrieved ${freshEvents.length} events`);
          } catch (err) {
            console.error("[useCalendar] Error fetching direct business events:", err);
          }
        };
        
        fetchDirectData();
        
        const intervalId = setInterval(() => {
          console.log("[useCalendar] Periodic refresh for business data");
          fetchDirectData();
          if (refetchCombined) refetchCombined();
        }, 15000); // Refresh every 15 seconds for more consistent data
        
        return () => clearInterval(intervalId);
      }
    }
  }, [businessId, queryClient, publicMode, fromDashboard, refetchCombined]);

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
      if (publicMode && businessId) {
        console.log("[useCalendar] Creating event request with business_id:", businessId);
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
        console.log("[useCalendar] Creating regular event:", 
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
        console.error("[useCalendar] Error updating event:", error);
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
        console.error("[useCalendar] Error deleting event:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to delete event",
          variant: "destructive",
        });
        throw error;
      }
    }
  });

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
    console.log(`[useCalendar] Using ${displayEvents.length} explicitly provided external events in public mode`);
  } else if (publicMode && businessId && combinedEvents && combinedEvents.length > 0) {
    displayEvents = combinedEvents;
    console.log(`[useCalendar] Using ${displayEvents.length} combined events from hook in public mode`);
  } else if (fromDashboard && businessId && combinedEvents && combinedEvents.length > 0) {
    displayEvents = combinedEvents;
    console.log(`[useCalendar] Using ${displayEvents.length} combined events from hook in dashboard mode`);
  } else if (!publicMode && Array.isArray(events) && events.length > 0) {
    displayEvents = events;
    console.log(`[useCalendar] Using ${displayEvents.length} internal events in private mode`);
  } else if (Array.isArray(externalEvents) && externalEvents.length > 0) {
    displayEvents = externalEvents;
    console.log(`[useCalendar] Using ${displayEvents.length} external events as fallback`);
  }

  if (displayEvents.length > 0) {
    console.log("[useCalendar] Events to display:", displayEvents.slice(0, 3).map(e => ({ 
      id: e.id,
      title: e.title,
      start: e.start_date,
      end: e.end_date
    })));
  }

  return {
    selectedDate,
    view,
    days: getDaysForView(),
    displayEvents,
    isLoading: isLoading || loadingCombined,
    error,
    publicMode,
    user,
    navigate,
    
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    dialogSelectedDate,
    
    setView,
    handlePrevious,
    handleNext,
    handleCalendarDayClick,
    handleAddEventClick,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    
    businessId
  };
};
