import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  LayoutDayFASTIcon,
  MonitorIcon
} from "lucide-react";
import {
  add,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  addMonths,
  isEqual,
  format,
  startOfWeek,
  endOfWeek,
  isBefore,
  isAfter,
  compareAsc,
} from "date-fns";
import { CalendarView } from "./CalendarView";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { EventDialog } from "./EventDialog";
import { useEventDialog } from "./hooks/useEventDialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EventSummary } from "./EventSummary";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

interface CalendarProps {
  defaultView?: CalendarViewType;
  currentView?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
  isExternalCalendar?: boolean;
  businessId?: string;
  businessUserId?: string | null;
  showAllEvents?: boolean;
  allowBookingRequests?: boolean;
  directEvents?: CalendarEventType[];
  onDayClick?: (date: Date, hour?: number) => void;
}

export function Calendar({
  defaultView = "month",
  currentView,
  onViewChange,
  isExternalCalendar = false,
  businessId,
  businessUserId,
  showAllEvents = false,
  allowBookingRequests = false,
  directEvents,
  onDayClick,
}: CalendarProps) {
  const [view, setView] = useState<CalendarViewType>(defaultView);
  const [today] = useState<Date>(new Date());
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryEvent, setSummaryEvent] = useState<CalendarEventType | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  // Use the passed view if provided
  useEffect(() => {
    if (currentView) {
      setView(currentView);
    }
  }, [currentView]);

  // Create a named function for the event dialog handler
  const createEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    console.log("Creating event:", data);
    if (!user && !businessUserId) {
      throw new Error("No user ID available to create event");
    }
    
    try {
      // Insert the event
      const { data: createdEvent, error } = await supabase
        .from("events")
        .insert({
          ...data,
          user_id: user?.id || businessUserId,
          type: isExternalCalendar ? 'business_calendar' : undefined
        })
        .select()
        .single();

      if (error) throw error;
      if (!createdEvent) throw new Error("Failed to create event");
      
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      
      return createdEvent as CalendarEventType;
    } catch (error: any) {
      console.error("Error creating event:", error);
      throw error;
    }
  };

  const updateEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    console.log("Updating event:", data);
    if (!data.id) {
      throw new Error("Event ID is required for updates");
    }
    
    try {
      // Update the event
      const { data: updatedEvent, error } = await supabase
        .from("events")
        .update(data)
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      if (!updatedEvent) throw new Error("Failed to update event");
      
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      
      return updatedEvent as CalendarEventType;
    } catch (error: any) {
      console.error("Error updating event:", error);
      throw error;
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    console.log("Deleting event:", id);
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (error: any) {
      console.error("Error deleting event:", error);
      throw error;
    }
  };

  const {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedDate,
    setSelectedDate,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({
    createEvent,
    updateEvent, 
    deleteEvent
  });

  // Reset selected date when current date changes
  useEffect(() => {
    setSelectedDate(currentDate);
  }, [currentDate]);

  const handleChangeView = (newView: CalendarViewType) => {
    setView(newView);
    if (onViewChange) {
      onViewChange(newView);
    }
  };

  // Calculate days to display based on view
  const days = useMemo(() => {
    if (view === "month") {
      const firstDay = startOfMonth(currentDate);
      const lastDay = endOfMonth(currentDate);
      const startDay = startOfWeek(firstDay);
      const endDay = endOfWeek(lastDay);
      return eachDayOfInterval({ start: startDay, end: endDay });
    } else if (view === "week") {
      const startDay = startOfWeek(currentDate);
      const endDay = endOfWeek(currentDate);
      return eachDayOfInterval({ start: startDay, end: endDay });
    } else {
      // Day view
      return [currentDate];
    }
  }, [currentDate, view]);

  // Fetch events from our database
  const { data: eventsData = [], isLoading } = useQuery({
    queryKey: ["events", user?.id, format(currentDate, "yyyy-MM"), view, businessId, businessUserId],
    queryFn: async () => {
      // If using direct events, return those instead of fetching
      if (directEvents) {
        console.log("Using direct events:", directEvents.length);
        return directEvents;
      }

      const startRange = days[0];
      const endRange = add(days[days.length - 1], { days: 1 });
      
      try {
        let eventsQuery = supabase
          .from("events")
          .select("*")
          .gte("start_date", startRange.toISOString())
          .lt("start_date", endRange.toISOString());
          
        // Filter by business owner if this is a business calendar
        if (businessUserId) {
          eventsQuery = eventsQuery.eq("user_id", businessUserId);
        } 
        // Otherwise filter by current user
        else if (user?.id) {
          eventsQuery = eventsQuery.eq("user_id", user.id);
        }

        const { data, error } = await eventsQuery;
          
        if (error) {
          console.error("Error fetching events:", error);
          throw error;
        }
        
        return data as CalendarEventType[];
      } catch (error) {
        console.error("Exception in events query:", error);
        return [];
      }
    },
    enabled: (!directEvents && (!!user?.id || !!businessUserId)),
  });

  const events: CalendarEventType[] = useMemo(() => {
    if (directEvents) {
      return directEvents;
    }
    return eventsData || [];
  }, [eventsData, directEvents]);

  const handleDayClick = (date: Date, hour?: number) => {
    if (onDayClick) {
      onDayClick(date, hour);
      return;
    }
    
    if (!isExternalCalendar) {
      setSelectedDate(date);
      setIsNewEventDialogOpen(true);
    }
  };

  const handleEventClick = (event: CalendarEventType) => {
    if (isExternalCalendar) {
      // For external calendars, show summary instead of edit dialog
      setSummaryEvent(event);
      setShowSummary(true);
    } else {
      setSelectedEvent(event);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center pb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(today)}
            title={t("calendar.today")}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => 
              view === "month" 
                ? setCurrentDate(subMonths(currentDate, 1))
                : setCurrentDate(add(currentDate, { days: -7 }))
            }
            title={t("calendar.previous")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => 
              view === "month" 
                ? setCurrentDate(addMonths(currentDate, 1))
                : setCurrentDate(add(currentDate, { days: 7 }))
            }
            title={t("calendar.next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">
            {format(currentDate, view === "day" ? "MMMM d, yyyy" : "MMMM yyyy")}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={(v) => handleChangeView(v as CalendarViewType)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t("calendar.viewType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t("calendar.day")}</SelectItem>
              <SelectItem value="week">{t("calendar.week")}</SelectItem>
              <SelectItem value="month">{t("calendar.month")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grow h-0">
        <CalendarView
          days={days}
          events={events}
          selectedDate={selectedDate || currentDate}
          view={view}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
          isExternalCalendar={isExternalCalendar}
        />
      </div>

      {!isExternalCalendar && (
        <EventDialog
          open={!!selectedEvent || isNewEventDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedEvent(null);
              setIsNewEventDialogOpen(false);
            }
          }}
          selectedDate={selectedDate}
          event={selectedEvent || undefined}
          onSubmit={selectedEvent ? handleUpdateEvent : handleCreateEvent}
          onDelete={selectedEvent ? handleDeleteEvent : undefined}
        />
      )}

      {isExternalCalendar && (
        <Dialog open={showSummary} onOpenChange={setShowSummary}>
          <EventSummary
            event={summaryEvent}
            onClose={() => setShowSummary(false)}
            isExternalCalendar
          />
        </Dialog>
      )}
    </div>
  );
}
