
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
    deleteEvent
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
    handleDeleteEvent();
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

  return (
    <div className="flex flex-col h-full">
      <CalendarHeader
        currentDate={currentDate}
        currentView={view}
        onDateChange={handleDateChange}
        onViewChange={handleViewChange}
        isExternalCalendar={isExternalCalendar}
      />
      <div className="relative h-full">
        <CalendarGrid
          currentDate={currentDate}
          currentView={view}
          onEventClick={handleEventClick}
          isExternalCalendar={isExternalCalendar}
          businessId={businessId}
          businessUserId={businessUserId}
          showAllEvents={showAllEvents}
          allowBookingRequests={allowBookingRequests}
          directEvents={directEvents}
          onTimeSlotClick={handleTimeSlotClick}
        />
        {!isExternalCalendar && <TimeIndicator currentDate={currentDate} currentView={view} />}
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
