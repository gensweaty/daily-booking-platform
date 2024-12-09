import { useState } from "react";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";

export const useEventDialog = () => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date } | null>(null);
  const { createEvent, updateEvent, deleteEvent } = useCalendarEvents();

  const handleDayClick = (date: Date, hour?: number, view?: CalendarViewType) => {
    const clickedDate = new Date(date);
    
    if (hour !== undefined) {
      clickedDate.setHours(hour, 0, 0, 0);
    } else if (view === "month") {
      clickedDate.setHours(9, 0, 0, 0);
    }
    
    setSelectedSlot({ date: clickedDate });
    setSelectedEvent(null);
    setIsNewEventDialogOpen(true);
  };

  const handleCreateEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    const result = await createEvent(data);
    setIsNewEventDialogOpen(false);
    return result;
  };

  const handleUpdateEvent = async (data: Partial<CalendarEventType>): Promise<CalendarEventType> => {
    if (!selectedEvent) throw new Error("No event selected");
    const result = await updateEvent({ id: selectedEvent.id, updates: data });
    setSelectedEvent(null);
    return result;
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) throw new Error("No event selected");
    await deleteEvent(selectedEvent.id);
    setSelectedEvent(null);
  };

  return {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedSlot,
    setSelectedSlot,
    handleDayClick,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  };
};