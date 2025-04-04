import { useState, useEffect } from "react";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarIcon, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, endOfWeek, isSameMonth, isSameDay, subMonths, addMonths } from "date-fns";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useEventDialog } from "./hooks/useEventDialog";

interface CalendarProps {
  defaultView?: CalendarViewType;
  currentView?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  businessId?: string;
  businessUserId?: string | null;
  isExternalCalendar?: boolean;
  showAllEvents?: boolean;
  allowBookingRequests?: boolean;
  directEvents?: CalendarEventType[];
  onDayClick?: (date: Date, hour?: number) => void;
}

export const Calendar = ({
  defaultView = "month",
  currentView,
  onViewChange,
  selectedDate,
  onDateSelect,
  businessId,
  businessUserId,
  isExternalCalendar = false,
  showAllEvents = false,
  allowBookingRequests = false,
  directEvents = [],
  onDayClick,
}: CalendarProps) => {
  const [view, setView] = useState<CalendarViewType>(currentView || defaultView);
  const [date, setDate] = useState(selectedDate || new Date());
  const [selectedDay, setSelectedDate] = useState<Date | null>(selectedDate || new Date());
  const { events, isLoading, error } = useCalendarEvents(businessId, businessUserId);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);

  const {
    selectedEvent,
    setSelectedEvent,
    setIsNewEventDialogOpen: setIsEventDialogOpen,
    setSelectedDate: setSelectedDialogDate,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({
    createEvent: useCalendarEvents(businessId, businessUserId).createEvent,
    updateEvent: useCalendarEvents(businessId, businessUserId).updateEvent,
    deleteEvent: useCalendarEvents(businessId, businessUserId).deleteEvent,
  });

  useEffect(() => {
    if (currentView) {
      setView(currentView);
    }
  }, [currentView]);

  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
      setSelectedDate(selectedDate);
    }
  }, [selectedDate]);

  const getDaysInMonth = (date: Date): Date[] => {
    const firstDayOfMonth = startOfMonth(date);
    const lastDayOfMonth = endOfMonth(firstDayOfMonth);
    const firstDayOfWeek = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
    const lastDayOfWeek = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });

    const days: Date[] = [];
    let currentDay = firstDayOfWeek;

    while (currentDay <= lastDayOfWeek) {
      days.push(currentDay);
      currentDay = addDays(currentDay, 1);
    }

    return days;
  };

  const days = getDaysInMonth(date);

  const handleDayClick = (date: Date, hour?: number) => {
    setSelectedDate(date);
    if (onDateSelect) {
      onDateSelect(date);
    }
    if (isExternalCalendar && allowBookingRequests) {
      if (onDayClick) {
        onDayClick(date, hour);
      }
    } else if (!isExternalCalendar) {
      setIsNewEventDialogOpen(true);
    }
  };

  const handleEventClick = (event: CalendarEventType) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleNewEventClick = () => {
    setSelectedEvent(null);
    setSelectedDialogDate(selectedDay);
    setIsNewEventDialogOpen(true);
  };

  const eventsToShow = showAllEvents ? directEvents : events.filter((event) => {
    const eventStart = new Date(event.start_date);
    return isSameMonth(date, eventStart);
  });

  console.log("[Calendar] Rendering with props:", {
    isExternalCalendar,
    businessId,
    businessUserId,
    allowBookingRequests,
    directEvents: directEvents?.length || 0,
    fetchedEvents: events?.length || 0,
    eventsCount: eventsToShow.length,
    view: currentView || view,
  });

  if (eventsToShow.length > 0) {
    console.log("[Calendar] First event:", eventsToShow[0]);
  }

  return (
    <div className="w-full">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium">
            {format(date, "MMMM yyyy")}
          </p>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="ml-auto h-8 w-[200px]"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span>{view === "month" ? "Month" : "Day"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <Button
                  variant="ghost"
                  className="ml-auto h-8 w-[200px] justify-start pl-4"
                  onClick={() => {
                    setView("month");
                    onViewChange && onViewChange("month");
                  }}
                >
                  Month
                </Button>
                <Button
                  variant="ghost"
                  className="ml-auto h-8 w-[200px] justify-start pl-4"
                  onClick={() => {
                    setView("day");
                    onViewChange && onViewChange("day");
                  }}
                >
                  Day
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setDate(subMonths(date, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setDate(addMonths(date, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-0">
          <CalendarView
            days={days}
            events={eventsToShow}
            selectedDate={selectedDay || new Date()}
            view={view}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
            isExternalCalendar={isExternalCalendar}
          />
        </CardContent>
        {!isExternalCalendar && (
          <CardFooter className="flex justify-between p-4">
            <Button onClick={handleNewEventClick}>
              <Plus className="mr-2 h-4 w-4" /> Add Event
            </Button>
          </CardFooter>
        )}
      </Card>

      <EventDialog
        open={isNewEventDialogOpen}
        onOpenChange={setIsNewEventDialogOpen}
        selectedDate={selectedDay}
        onSubmit={isExternalCalendar
          ? useCalendarEvents(businessId, businessUserId).createEvent
          : handleCreateEvent
        }
        onDelete={selectedEvent ? handleDeleteEvent : undefined}
        event={selectedEvent}
      />
    </div>
  );
};
