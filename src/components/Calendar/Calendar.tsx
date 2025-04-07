import { useState } from "react";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarViewType } from "@/lib/types/calendar";
import { CalendarView } from "./CalendarView";
import { useCalendarView } from "./hooks/useCalendarView";
import { EventDialog } from "./EventDialog";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useEventDialog } from "./hooks/useEventDialog";

export function Calendar() {
  const [date, setDate] = useState<Date>(new Date());
  
  // Update to include the CRUD methods from useCalendarEvents
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const { selectedView, setSelectedView } = useCalendarView();
  
  // Use proper hook params
  const eventDialogHooks = useEventDialog({
    createEvent,
    updateEvent,
    deleteEvent
  });
  
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
  } = eventDialogHooks;

  return (
    <div className="w-full max-w-md flex flex-col">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-semibold">
          {format(date, "MMMM yyyy")}
        </h2>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedView('month')}
            active={selectedView === 'month'}
          >
            Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedView('week')}
            active={selectedView === 'week'}
          >
            Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedView('day')}
            active={selectedView === 'day'}
          >
            Day
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
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
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <CalendarView
        date={date}
        selectedView={selectedView}
        events={events}
        onSelectEvent={(event) => {
          setSelectedEvent(event);
          setIsNewEventDialogOpen(true);
        }}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setSelectedEvent(null);
          setIsNewEventDialogOpen(true);
        }}
      />
      <Button onClick={() => {
        setSelectedDate(new Date());
        setSelectedEvent(null);
        setIsNewEventDialogOpen(true);
      }}>Add Event</Button>
      <EventDialog
        isOpen={isNewEventDialogOpen}
        onClose={() => setIsNewEventDialogOpen(false)}
        selectedEvent={selectedEvent}
        selectedDate={selectedDate}
        onCreate={handleCreateEvent}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}
