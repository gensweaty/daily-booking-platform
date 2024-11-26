import { useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isSameMonth, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvents, createEvent, updateEvent, deleteEvent } from "@/lib/api";
import { CalendarEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CalendarHeader } from "./CalendarHeader";
import { EventDialog } from "./EventDialog";

const views = ["month", "week", "day"] as const;
type ViewType = typeof views[number];

export const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: "Success", description: "Event created successfully" });
      setIsNewEventDialogOpen(false);
    },
  });

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

  const handleDayClick = (date: Date) => {
    setSelectedSlot(date);
    setIsNewEventDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const days = getDaysForView();

  if (isLoading) return <div>Loading calendar...</div>;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">
            {format(selectedDate, "MMMM yyyy")}
          </h2>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border border-input overflow-hidden">
            {views.map((v) => (
              <Button
                key={v}
                variant={view === v ? "default" : "ghost"}
                className="rounded-none"
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Button>
            ))}
          </div>
          <Button onClick={() => setIsNewEventDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {view === "month" && (
          <>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="bg-white p-4 text-center font-semibold">
                {day}
              </div>
            ))}
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`bg-white p-4 min-h-[120px] cursor-pointer hover:bg-gray-50 ${
                  !isSameMonth(day, selectedDate) ? "text-gray-400" : ""
                }`}
                onClick={() => handleDayClick(day)}
              >
                <div className="font-medium">{format(day, "d")}</div>
                <div className="mt-2 space-y-1">
                  {events
                    .filter((event) => isSameDay(new Date(event.start_date), day))
                    .map((event) => (
                      <div
                        key={event.id}
                        className="text-sm p-1 rounded bg-primary/10 text-primary cursor-pointer truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <EventDialog
        open={isNewEventDialogOpen}
        onOpenChange={setIsNewEventDialogOpen}
        selectedDate={selectedSlot}
        onSubmit={(data) => createEventMutation.mutate(data)}
      />

      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent>
            <DialogTitle>{selectedEvent.title}</DialogTitle>
            <div className="space-y-4 mt-4">
              <div>
                <div className="font-medium">Date & Time</div>
                <div>{format(new Date(selectedEvent.start_date), "PPpp")}</div>
              </div>
              {selectedEvent.description && (
                <div>
                  <div className="font-medium">Description</div>
                  <div>{selectedEvent.description}</div>
                </div>
              )}
              {selectedEvent.location && (
                <div>
                  <div className="font-medium">Location</div>
                  <div>{selectedEvent.location}</div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};