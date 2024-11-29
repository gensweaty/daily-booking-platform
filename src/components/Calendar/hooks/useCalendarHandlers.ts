import { addDays, addMonths, subMonths, addHours, setHours, setMinutes } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";

export const useCalendarHandlers = () => {
  const { toast } = useToast();
  const { updateEvent } = useCalendarEvents();

  const handleEventDrop = async (event: CalendarEventType, newDate: Date, newHour?: number) => {
    try {
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      const duration = endDate.getTime() - startDate.getTime();

      let newStartDate = newDate;
      if (newHour !== undefined) {
        newStartDate = setHours(setMinutes(newStartDate, 0), newHour);
      } else {
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

  const handleDayClick = (date: Date, hour?: number) => {
    let startDate = date;
    if (view === "month") {
      startDate = setHours(setMinutes(date, 0), 12);
    } else if (hour !== undefined) {
      startDate = setHours(setMinutes(date, 0), hour);
    }
    
    setSelectedSlot({ 
      date: startDate,
      hour: hour
    });
    setIsNewEventDialogOpen(true);
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

  return {
    handleEventDrop,
    handleDayClick,
    handlePrevious,
    handleNext,
  };
};