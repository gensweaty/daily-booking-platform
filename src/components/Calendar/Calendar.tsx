import { useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addHours,
  setHours,
  format,
} from "date-fns";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { CalendarViewType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TimeIndicator } from "./TimeIndicator";

export const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("week");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour?: number } | null>(null);
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate("/signin");
    return null;
  }

  const getDaysForView = () => {
    switch (view) {
      case "month":
        return eachDayOfInterval({
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate),
        });
      case "week":
        return eachDayOfInterval({
          start: startOfWeek(selectedDate),
          end: endOfWeek(selectedDate),
        });
      case "day":
        return [selectedDate];
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

  const handleDayClick = (date: Date, hour?: number) => {
    let startDate = date;
    
    // Ensure we always use the clicked hour or default to current hour
    if (hour !== undefined) {
      // For week/day view, use the clicked hour
      startDate = setHours(date, hour);
    } else if (view === "month") {
      // For month view, set default time to 12:00 PM
      startDate = setHours(date, 12);
    } else {
      // Default to current hour if no hour specified
      startDate = setHours(date, new Date().getHours());
    }

    // Ensure minutes are set to 0 for consistency
    startDate = new Date(startDate.setMinutes(0));
    
    setSelectedSlot({ 
      date: startDate,
      hour: hour
    });
    setIsNewEventDialogOpen(true);
  };

  if (error) {
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

  if (isLoading) {
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
        onAddEvent={() => {
          setSelectedSlot({ date: setHours(new Date(), 12) });
          setIsNewEventDialogOpen(true);
        }}
      />

      <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
        {view !== 'month' && <TimeIndicator />}
        <div className="flex-1">
          <CalendarView
            days={getDaysForView()}
            events={events || []}
            selectedDate={selectedDate}
            view={view}
            onDayClick={handleDayClick}
            onEventClick={setSelectedEvent}
          />
        </div>
      </div>

      <EventDialog
        open={isNewEventDialogOpen}
        onOpenChange={setIsNewEventDialogOpen}
        selectedDate={selectedSlot?.date || null}
        defaultEndDate={selectedSlot?.date ? addHours(selectedSlot.date, 1) : null}
        onSubmit={async (data) => {
          try {
            // Ensure we preserve the exact time when creating the event
            const eventData = {
              ...data,
              start_date: data.start_date,
              end_date: data.end_date
            };
            
            await createEvent(eventData);
            setIsNewEventDialogOpen(false);
            toast({
              title: "Success",
              description: "Event created successfully",
            });
          } catch (error: any) {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        }}
      />

      {selectedEvent && (
        <EventDialog
          open={!!selectedEvent}
          onOpenChange={() => setSelectedEvent(null)}
          selectedDate={new Date(selectedEvent.start_date)}
          event={selectedEvent}
          onSubmit={async (updates) => {
            try {
              // Ensure we preserve the exact time when updating the event
              const eventUpdates = {
                ...updates,
                start_date: updates.start_date,
                end_date: updates.end_date
              };
              
              await updateEvent({
                id: selectedEvent.id,
                updates: eventUpdates,
              });
              setSelectedEvent(null);
              toast({
                title: "Success",
                description: "Event updated successfully",
              });
            } catch (error: any) {
              toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
              });
            }
          }}
          onDelete={async () => {
            try {
              await deleteEvent(selectedEvent.id);
              setSelectedEvent(null);
              toast({
                title: "Success",
                description: "Event deleted successfully",
              });
            } catch (error: any) {
              toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
              });
            }
          }}
        />
      )}
    </div>
  );
};