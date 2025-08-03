
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
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

interface CalendarProps {
  businessId?: string;
  businessUserId?: string;
  currentView?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
  isExternalCalendar?: boolean;
  showAllEvents?: boolean;
  allowBookingRequests?: boolean;
  directEvents?: CalendarEventType[];
}

export const Calendar = ({ 
  businessId, 
  businessUserId,
  currentView,
  onViewChange,
  isExternalCalendar = false,
  showAllEvents = false,
  allowBookingRequests = false,
  directEvents
}: CalendarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<CalendarViewType>(currentView || 'month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [dialogSelectedDate, setDialogSelectedDate] = useState<Date | undefined>(undefined);

  // Use external events if provided, otherwise fetch from hook
  const {
    events: fetchedEvents,
    isLoading,
    createEvent,
    updateEvent,
    deleteEvent,
    refetch
  } = useCalendarEvents(businessId, businessUserId);

  const events = directEvents || fetchedEvents;

  // Sync view type with external prop
  useEffect(() => {
    if (currentView && currentView !== viewType) {
      setViewType(currentView);
    }
  }, [currentView, viewType]);

  // Generate days array based on current view
  const getDaysForView = () => {
    if (viewType === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else if (viewType === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else { // day view
      return [currentDate];
    }
  };

  const days = getDaysForView();

  const handleViewChange = (newView: CalendarViewType) => {
    setViewType(newView);
    onViewChange?.(newView);
  };

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
      
      // Set default time if not provided
      const startDate = data.start_date || new Date().toISOString();
      const endDate = data.end_date || new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      const eventData = {
        ...data,
        type: 'event',
        title: data.user_surname || data.title,
        user_surname: data.user_surname || data.title,
        payment_status: data.payment_status || 'not_paid',
        language: data.language || 'en',
        start_date: startDate,
        end_date: endDate,
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

  if (isLoading && !directEvents) {
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
            selectedDate={currentDate}
            view={viewType}
            onViewChange={handleViewChange}
            onPrevious={() => {
              const newDate = new Date(currentDate);
              if (viewType === 'month') {
                newDate.setMonth(newDate.getMonth() - 1);
              } else if (viewType === 'week') {
                newDate.setDate(newDate.getDate() - 7);
              } else {
                newDate.setDate(newDate.getDate() - 1);
              }
              setCurrentDate(newDate);
            }}
            onNext={() => {
              const newDate = new Date(currentDate);
              if (viewType === 'month') {
                newDate.setMonth(newDate.getMonth() + 1);
              } else if (viewType === 'week') {
                newDate.setDate(newDate.getDate() + 7);
              } else {
                newDate.setDate(newDate.getDate() + 1);
              }
              setCurrentDate(newDate);
            }}
            onAddEvent={() => {
              setDialogSelectedDate(new Date());
              setIsNewEventDialogOpen(true);
            }}
            isExternalCalendar={isExternalCalendar}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <CalendarGrid
          days={days}
          events={events}
          formattedSelectedDate={currentDate.toISOString().split('T')[0]}
          view={viewType}
          onDayClick={handleDateSelect}
          onEventClick={handleEventClick}
          isExternalCalendar={isExternalCalendar}
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
          dialogSelectedDate={dialogSelectedDate}
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
