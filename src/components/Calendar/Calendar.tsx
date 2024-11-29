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
  setMinutes,
  format,
  parseISO,
} from "date-fns";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TimeIndicator } from "./TimeIndicator";
import { DragDropContext } from "@hello-pangea/dnd";

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

  const handleEventDrop = async (event: CalendarEventType, newDate: Date, newHour?: number) => {
    try {
      const startDate = parseISO(event.start_date);
      const endDate = parseISO(event.end_date);
      const duration = endDate.getTime() - startDate.getTime();

      let newStartDate = newDate;
      if (newHour !== undefined) {
        newStartDate = setHours(setMinutes(newStartDate, 0), newHour);
      } else {
        // Preserve the original time if dropping on a day in month view
        newStartDate = setHours(
          setMinutes(newStartDate, startDate.getMinutes()),
          startDate.getHours()
        );
      }

      const newEndDate = new Date(newStartDate.getTime() + duration);

      await updateEvent({
        id: event.id,
        updates: {
          start_date: newStartDate.toISOString(),
          end_date: newEndDate.toISOString(),
        },
      });

      toast({
        title: "Success",
        description: "Event rescheduled successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

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
    if (view === "month") {
      // For month view, set default time to 12:00 PM
      startDate = setHours(setMinutes(date, 0), 12);
    } else if (hour !== undefined) {
      // For week/day view, use the clicked hour
      startDate = setHours(setMinutes(date, 0), hour);
    }
    
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
    <DragDropContext onDragEnd={(result) => {
      if (!result.destination) return;
      const [eventId, sourceDate] = result.draggableId.split("-");
      const event = events.find((e) => e.id === eventId);
      if (!event) return;

      const [destDate, destHour] = result.destination.droppableId.split("-");
      const newDate = new Date(destDate);
      const newHour = destHour ? parseInt(destHour) : undefined;

      handleEventDrop(event, newDate, newHour);
    }}>
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
              onEventDrop={handleEventDrop}
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
              await createEvent(data);
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
                await updateEvent({
                  id: selectedEvent.id,
                  updates,
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
    </DragDropContext>
  );
};