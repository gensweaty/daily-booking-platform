import { useState } from "react";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarViewType } from "@/lib/types/calendar";

export const useCalendarState = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("week");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour?: number } | null>(null);
  const { events, isLoading, error } = useCalendarEvents();

  return {
    selectedDate,
    setSelectedDate,
    view,
    setView,
    events,
    isLoading,
    error,
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedSlot,
    setSelectedSlot,
  };
};