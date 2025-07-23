
import React, { useState } from "react";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { EventDialog } from "./EventDialog";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarProps {
  businessId?: string;
  businessUserId?: string;
}

export const Calendar = ({ businessId, businessUserId }: CalendarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);

  const {
    events,
    isLoading,
    createEvent,
    updateEvent,
    deleteEvent,
    refetch
  } = useCalendarEvents(businessId, businessUserId);

  const handleEventClick = (event: CalendarEventType) => {
    console.log('[Calendar] Event clicked for editing:', {
      id: event.id,
      title: event.title,
      type: event.type,
      fullEvent: event
    });
    
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleDayClick = (date: Date) => {
    const newEvent: CalendarEventType = {
      id: '',
      title: '',
      start_date: date.toISOString(),
      end_date: new Date(date.getTime() + 60 * 60 * 1000).toISOString(),
      user_id: user?.id || '',
      user_surname: '',
      user_number: '',
      social_network_link: '',
      event_notes: '',
      payment_status: 'not_paid',
      type: 'event',
      created_at: new Date().toISOString(),
      deleted_at: null,
    };

    setSelectedEvent(newEvent);
    setShowEventDialog(true);
  };

  const handleSaveEvent = async (eventData: CalendarEventType) => {
    try {
      if (eventData.id) {
        await updateEvent(eventData);
      } else {
        await createEvent(eventData);
      }
      
      // Force refetch to ensure UI is updated
      setTimeout(() => {
        refetch();
      }, 500);
      
    } catch (error) {
      console.error('[Calendar] Error saving event:', error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("common.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string, deleteChoice?: "this" | "series") => {
    try {
      console.log('[Calendar] 🎯 Handling delete event:', { eventId, deleteChoice });
      
      await deleteEvent({ id: eventId, deleteChoice });
      
      console.log('[Calendar] ✅ Delete event completed, triggering refresh');
      
      // Force multiple refetches to ensure UI updates
      setTimeout(() => refetch(), 100);
      setTimeout(() => refetch(), 500);
      setTimeout(() => refetch(), 1000);
      
    } catch (error) {
      console.error('[Calendar] ❌ Error deleting event:', error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("events.deleteEventError"),
        variant: "destructive",
      });
    }
  };

  const handlePrevious = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNext = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CalendarHeader
        selectedDate={currentDate}
        view="month"
        onViewChange={() => {}}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
      
      <CalendarGrid
        currentDate={currentDate}
        events={events}
        onEventClick={handleEventClick}
        onDayClick={handleDayClick}
      />

      <EventDialog
        event={selectedEvent}
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
};
