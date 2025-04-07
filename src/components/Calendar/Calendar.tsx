
import React, { useState, useEffect } from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { TimeIndicator } from "./TimeIndicator";
import { useEventDialog } from "./hooks/useEventDialog";
import { EventDialog } from "./EventDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";

export interface CalendarProps {
  defaultView?: CalendarViewType;
  currentView?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
  isExternalCalendar?: boolean;
  businessId?: string;
  businessUserId?: string | null;
  showAllEvents?: boolean;
  allowBookingRequests?: boolean;
  directEvents?: CalendarEventType[];
  onTimeSlotClick?: (date: Date, startTime?: string, endTime?: string) => void;
}

export const Calendar = ({ 
  defaultView = "week",
  currentView,
  onViewChange,
  isExternalCalendar = false,
  businessId,
  businessUserId,
  showAllEvents = false,
  allowBookingRequests = false,
  directEvents,
  onTimeSlotClick
}: CalendarProps) => {
  const [view, setView] = useState<CalendarViewType>(currentView || defaultView);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  
  // Initialize the calendar events hook
  const {
    createEvent,
    updateEvent,
    deleteEvent,
    events: calendarEvents
  } = useCalendarEvents(businessId, businessUserId);

  // Initialize the event dialog hook with the event handlers
  const { 
    isDialogOpen, 
    openDialog, 
    closeDialog,
    handleDeleteEvent,
    setSelectedEvent: setDialogSelectedEvent
  } = useEventDialog({
    createEvent,
    updateEvent,
    deleteEvent
  });

  useEffect(() => {
    if (onViewChange) {
      onViewChange(view);
    }
  }, [view, onViewChange]);

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleViewChange = (newView: CalendarViewType) => {
    setView(newView);
  };

  const handleEventClick = (event: CalendarEventType) => {
    setSelectedEvent(event);
    setDialogSelectedEvent(event);
    openDialog();
  };

  const handleCloseDialog = () => {
    setSelectedEvent(null);
    closeDialog();
  };

  const handleDeleteEventClick = (eventId: string) => {
    handleDeleteEvent(eventId);
  };

  const handleTimeSlotClick = (date: Date, startTime?: string, endTime?: string) => {
    if (onTimeSlotClick) {
      onTimeSlotClick(date, startTime, endTime);
    } else if (!isExternalCalendar) {
      const newEvent: CalendarEventType = {
        id: "new",
        title: t("calendar.newEvent"),
        start_date: startTime ? `${date.toISOString().split('T')[0]}T${startTime}:00` : date.toISOString(),
        end_date: endTime ? `${date.toISOString().split('T')[0]}T${endTime}:00` : date.toISOString(),
        created_at: new Date().toISOString(),
        user_id: businessUserId || '',
      };
      setSelectedEvent(newEvent);
      setDialogSelectedEvent(newEvent);
      openDialog();
    }
  };

  // Generate days array based on current view
  const generateDaysArray = (): Date[] => {
    const days: Date[] = [];
    if (view === "day") {
      days.push(new Date(currentDate));
    } else if (view === "week") {
      const start = new Date(currentDate);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
    } else if (view === "month") {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Include days from previous month to fill the first week
      const firstDayWeekday = firstDay.getDay();
      for (let i = 0; i < firstDayWeekday; i++) {
        const d = new Date(firstDay);
        d.setDate(d.getDate() - (firstDayWeekday - i));
        days.push(d);
      }
      
      // Add all days of current month
      for (let i = 1; i <= lastDay.getDate(); i++) {
        days.push(new Date(year, month, i));
      }
      
      // Add days from next month to fill the last week
      const lastDayWeekday = lastDay.getDay();
      for (let i = 1; i < 7 - lastDayWeekday; i++) {
        const d = new Date(lastDay);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
    }
    return days;
  };

  // Get the events to display
  const eventsToDisplay = directEvents || calendarEvents || [];

  return (
    <div className="flex flex-col h-full">
      <CalendarHeader
        selectedDate={currentDate}
        view={view}
        onViewChange={handleViewChange}
        onPrevious={() => {
          // Handle previous date based on current view
          const newDate = new Date(currentDate);
          if (view === "day") {
            newDate.setDate(newDate.getDate() - 1);
          } else if (view === "week") {
            newDate.setDate(newDate.getDate() - 7);
          } else {
            newDate.setMonth(newDate.getMonth() - 1);
          }
          setCurrentDate(newDate);
        }}
        onNext={() => {
          // Handle next date based on current view
          const newDate = new Date(currentDate);
          if (view === "day") {
            newDate.setDate(newDate.getDate() + 1);
          } else if (view === "week") {
            newDate.setDate(newDate.getDate() + 7);
          } else {
            newDate.setMonth(newDate.getMonth() + 1);
          }
          setCurrentDate(newDate);
        }}
        isExternalCalendar={isExternalCalendar}
        onAddEvent={!isExternalCalendar ? () => handleTimeSlotClick(currentDate) : undefined}
      />
      <div className="relative h-full">
        <CalendarGrid
          days={generateDaysArray()}
          events={eventsToDisplay}
          formattedSelectedDate={currentDate.toISOString()}
          view={view}
          onDayClick={handleTimeSlotClick}
          onEventClick={handleEventClick}
          isExternalCalendar={isExternalCalendar}
        />
        {!isExternalCalendar && <TimeIndicator 
          view={view} 
          selectedDate={currentDate}
        />}
      </div>

      <EventDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        event={selectedEvent}
        businessId={businessId}
        businessUserId={businessUserId}
        onDelete={handleDeleteEventClick}
      />
    </div>
  );
};
