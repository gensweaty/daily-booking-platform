import React, { useState, useEffect } from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { TimeIndicator } from "./TimeIndicator";
import { useEventDialog } from "./hooks/useEventDialog";
import { EventDialog } from "./EventDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { isDialogOpen, openDialog, closeDialog } = useEventDialog();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const { mutate: deleteEventMutation } = useMutation(
    async (eventId: string) => {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) {
        throw new Error(error.message);
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["events"]);
        closeDialog();
      },
    }
  );

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
    openDialog();
  };

  const handleCloseDialog = () => {
    setSelectedEvent(null);
    closeDialog();
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEventMutation(eventId);
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
        onDelete={handleDeleteEvent}
      />
    </div>
  );
};
