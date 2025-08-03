import { useEffect, useState, useRef } from 'react';
import { CalendarGrid } from './CalendarGrid';
import { CalendarHeader } from './CalendarHeader';
import { EventDialog } from './EventDialog';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { CalendarEventType, CalendarViewType } from '@/lib/types/calendar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CalendarProps {
  businessId?: string;
  businessUserId?: string;
}

export const Calendar = ({ businessId, businessUserId }: CalendarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [dialogSelectedDate, setDialogSelectedDate] = useState<Date | undefined>(undefined);

  const {
    events,
    isLoading,
    createEvent,
    updateEvent,
    deleteEvent,
    refetch
  } = useCalendarEvents(businessId, businessUserId);

  const handleEventClick = (event: CalendarEventType) => {
    setSelectedEvent(event);
  };

  const handleDateSelect = (date: Date) => {
    setDialogSelectedDate(date);
    setIsNewEventDialogOpen(true);
  };

  const handleCreateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      console.log("Creating event with data:", data);
      
      const eventData = {
        ...data,
        type: 'event',
        title: data.user_surname || data.title,
        user_surname: data.user_surname || data.title,
        payment_status: data.payment_status || 'not_paid',
        language: data.language || 'en',
        // Include reminder fields
        reminder_at: data.reminder_at,
        email_reminder_enabled: data.email_reminder_enabled || false
      };
      
      const createdEvent = await createEvent(eventData);
      
      console.log("Event created successfully:", createdEvent);
      
      // Send reminder email if enabled and reminder_at is set
      if (createdEvent.email_reminder_enabled && createdEvent.reminder_at) {
        try {
          console.log("Sending event reminder email for:", createdEvent.id);
          
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-event-reminder-email', {
            body: { eventId: createdEvent.id }
          });

          if (emailError) {
            console.error("❌ Error sending event reminder email:", emailError);
            toast({
              title: "Warning",
              description: "Event created but reminder email failed to send",
              variant: "default",
            });
          } else {
            console.log("✅ Event reminder email sent successfully:", emailResult);
            toast({
              title: t("common.success"),
              description: "Event created and reminder email scheduled",
              duration: 3000,
            });
          }
        } catch (emailError) {
          console.error("❌ Failed to send event reminder email:", emailError);
          toast({
            title: "Warning",
            description: "Event created but reminder email failed to send",
            variant: "default",
          });
        }
      } else {
        toast({
          title: t("common.success"),
          description: "Event created successfully",
          duration: 3000,
        });
      }
      
      setIsNewEventDialogOpen(false);
      await refetch();
      
      return createdEvent;
    } catch (error: any) {
      console.error("Failed to create event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateEvent = async (data: Partial<CalendarEventType>) => {
    try {
      if (!selectedEvent) throw new Error("No event selected");
      
      console.log("Updating event with data:", data);
      
      const eventData = {
        ...data,
        id: selectedEvent.id,
        type: selectedEvent.type || 'event',
        title: data.user_surname || data.title || selectedEvent.title,
        user_surname: data.user_surname || data.title || selectedEvent.user_surname,
        payment_status: data.payment_status || selectedEvent.payment_status || 'not_paid',
        language: data.language || selectedEvent.language || 'en',
        // Include reminder fields
        reminder_at: data.reminder_at,
        email_reminder_enabled: data.email_reminder_enabled || false
      };
      
      const updatedEvent = await updateEvent(eventData);
      
      console.log("Event updated successfully:", updatedEvent);
      
      // Send reminder email if enabled and reminder_at is set
      if (updatedEvent.email_reminder_enabled && updatedEvent.reminder_at) {
        try {
          console.log("Sending event reminder email for updated event:", updatedEvent.id);
          
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-event-reminder-email', {
            body: { eventId: updatedEvent.id }
          });

          if (emailError) {
            console.error("❌ Error sending event reminder email:", emailError);
            toast({
              title: "Warning",
              description: "Event updated but reminder email failed to send",
              variant: "default",
            });
          } else {
            console.log("✅ Event reminder email sent successfully:", emailResult);
            toast({
              title: t("common.success"),
              description: "Event updated and reminder email scheduled",
              duration: 3000,
            });
          }
        } catch (emailError) {
          console.error("❌ Failed to send event reminder email:", emailError);
          toast({
            title: "Warning",
            description: "Event updated but reminder email failed to send",
            variant: "default",
          });
        }
      } else {
        toast({
          title: t("common.success"),
          description: "Event updated successfully",
          duration: 3000,
        });
      }
      
      setSelectedEvent(null);
      await refetch();
      
      return updatedEvent;
    } catch (error: any) {
      console.error("Failed to update event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteEvent = async (deleteChoice?: "this" | "series") => {
    try {
      if (!selectedEvent) throw new Error("No event selected");
      
      await deleteEvent({ id: selectedEvent.id, deleteChoice });
      
      setSelectedEvent(null);
      await refetch();
      
      toast({
        title: t("common.success"),
        description: "Event deleted successfully",
        duration: 3000,
      });
      
      return { success: true };
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none mb-4 space-y-4">
        <div className="flex items-center justify-between">
          <CalendarHeader 
            currentDate={currentDate}
            viewType={viewType}
            onDateChange={setCurrentDate}
            onViewChange={setViewType}
          />
          <Button
            onClick={() => {
              setDialogSelectedDate(new Date());
              setIsNewEventDialogOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('events.addEvent')}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <CalendarGrid
          events={events}
          currentDate={currentDate}
          viewType={viewType}
          onEventClick={handleEventClick}
          onDateSelect={handleDateSelect}
        />
      </div>

      {/* Event Dialogs */}
      <>
        <EventDialog
          key={dialogSelectedDate?.getTime()}
          isOpen={isNewEventDialogOpen}
          onClose={() => setIsNewEventDialogOpen(false)}
          selectedEvent={null}
          onCreate={handleCreateEvent}
          onUpdate={handleUpdateEvent}
          onDelete={handleDeleteEvent}
        />

        {selectedEvent && (
          <EventDialog
            key={selectedEvent.id}
            isOpen={!!selectedEvent}
            onClose={() => setSelectedEvent(null)}
            selectedEvent={selectedEvent}
            onCreate={handleCreateEvent}
            onUpdate={handleUpdateEvent}
            onDelete={handleDeleteEvent}
          />
        )}
      </>
    </div>
  );
};
