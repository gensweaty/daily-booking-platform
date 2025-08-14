import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { CalendarHeader } from "../Calendar/CalendarHeader";
import { CalendarView } from "../Calendar/CalendarView";
import { EventDialog } from "../Calendar/EventDialog";
import { TimeIndicator } from "../Calendar/TimeIndicator";
import { useEventDialog } from "../Calendar/hooks/useEventDialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  setHours,
  startOfDay,
  format,
} from "date-fns";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

interface PublicCalendarListProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
  onlineUsers: { name: string; email: string }[];
  hasPermissions?: boolean;
}

export const PublicCalendarList = ({ 
  boardUserId, 
  externalUserName, 
  externalUserEmail, 
  onlineUsers,
  hasPermissions = false
}: PublicCalendarListProps) => {
  console.log('🔍 PublicCalendarList props:', { hasPermissions, externalUserName, boardUserId });
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const { toast } = useToast();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { theme } = useTheme();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("week");

  // Fetch events using standard useQuery like in main dashboard
  const fetchEvents = async (): Promise<CalendarEventType[]> => {
    try {
      console.log('📅 Fetching public calendar events for user:', boardUserId);
      
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', boardUserId)
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (error) throw error;

      console.log('📅 Fetched events:', events?.length || 0);
      return events || [];
    } catch (error) {
      console.error('❌ Error fetching public calendar events:', error);
      throw error;
    }
  };

  const {
    data: events = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['publicCalendarEvents', boardUserId],
    queryFn: fetchEvents,
    enabled: !!boardUserId,
    staleTime: 0,
    gcTime: 1000,
    refetchInterval: 1500,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Create event function - identical to main dashboard
  const createEvent = async (eventData: Partial<CalendarEventType>) => {
    console.log('🔧 Creating event with sub-user metadata:', eventData);
    
    const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
      p_event_data: {
        title: eventData.user_surname || eventData.title,
        user_surname: eventData.user_surname,
        user_number: eventData.user_number,
        social_network_link: eventData.social_network_link,
        event_notes: eventData.event_notes,
        event_name: eventData.event_name,
        start_date: eventData.start_date,
        end_date: eventData.end_date,
        payment_status: eventData.payment_status || 'not_paid',
        payment_amount: eventData.payment_amount?.toString() || '',
        type: eventData.type || 'event',
        is_recurring: eventData.is_recurring || false,
        repeat_pattern: eventData.repeat_pattern,
        repeat_until: eventData.repeat_until,
        reminder_at: eventData.reminder_at,
        email_reminder_enabled: eventData.email_reminder_enabled || false
      },
      p_additional_persons: [],
      p_user_id: boardUserId,
      p_event_id: null,
      p_created_by_type: 'sub_user',
      p_created_by_name: externalUserName,
      p_last_edited_by_type: 'sub_user',
      p_last_edited_by_name: externalUserName
    });

    if (error) throw error;

    toast({
      title: "Event created successfully",
      description: "Your event has been added to the calendar.",
    });

    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
    
    return {
      id: savedEventId,
      title: eventData.user_surname || eventData.title || 'Untitled Event',
      start_date: eventData.start_date || new Date().toISOString(),
      end_date: eventData.end_date || new Date().toISOString(),
      user_id: boardUserId,
      type: eventData.type || 'event',
      created_at: new Date().toISOString(),
      ...eventData
    } as CalendarEventType;
  };

  // Update event function - identical to main dashboard
  const updateEvent = async (eventData: Partial<CalendarEventType>) => {
    console.log('🔧 Updating event with sub-user metadata:', eventData);
    
    const { data: savedEventId, error } = await supabase.rpc('save_event_with_persons', {
      p_event_data: {
        title: eventData.user_surname || eventData.title,
        user_surname: eventData.user_surname,
        user_number: eventData.user_number,
        social_network_link: eventData.social_network_link,
        event_notes: eventData.event_notes,
        event_name: eventData.event_name,
        start_date: eventData.start_date,
        end_date: eventData.end_date,
        payment_status: eventData.payment_status || 'not_paid',
        payment_amount: eventData.payment_amount?.toString() || '',
        type: eventData.type || 'event',
        is_recurring: eventData.is_recurring || false,
        repeat_pattern: eventData.repeat_pattern,
        repeat_until: eventData.repeat_until,
        reminder_at: eventData.reminder_at,
        email_reminder_enabled: eventData.email_reminder_enabled || false
      },
      p_additional_persons: [],
      p_user_id: boardUserId,
      p_event_id: eventData.id,
      p_created_by_type: 'sub_user',
      p_created_by_name: externalUserName,
      p_last_edited_by_type: 'sub_user',
      p_last_edited_by_name: externalUserName
    });

    if (error) throw error;

    toast({
      title: "Event updated successfully",
      description: "Your changes have been saved.",
    });

    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
    
    return {
      ...eventData,
      id: savedEventId || eventData.id,
    } as CalendarEventType;
  };

  // Delete event function - identical to main dashboard
  const deleteEvent = async ({ id: eventId, deleteChoice }: { id: string; deleteChoice?: "this" | "series" }) => {
    console.log('🔧 Deleting event:', eventId);
    
    const { data: result, error } = await supabase
      .rpc('delete_recurring_series', {
        p_event_id: eventId,
        p_user_id: boardUserId,
        p_delete_choice: deleteChoice || 'this'
      });

    if (error) throw error;
    
    toast({
      title: "Event deleted successfully",
      description: "The event has been removed from the calendar.",
    });

    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
    
    return result;
  };

  // Use the event dialog hook with our functions - identical to main dashboard
  const {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    selectedDate: dialogSelectedDate,
    setSelectedDate: setDialogSelectedDate,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({
    createEvent: hasPermissions ? createEvent : undefined,
    updateEvent: hasPermissions ? updateEvent : undefined,
    deleteEvent: hasPermissions ? deleteEvent : undefined
  });

  const handleEventClick = (event: CalendarEventType) => {
    if (hasPermissions) {
      // Check if this sub-user can edit this event
      const canEdit = event.created_by_type === 'sub_user' && event.created_by_name === externalUserName;
      if (canEdit) {
        setSelectedEvent(event);
      } else {
        toast({
          title: "Cannot edit event",
          description: "You can only edit events that you created.",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "Time slot not available",
        description: "This time slot is already booked. Please select a different time.",
      });
    }
  };

  const handleCalendarDayClick = (date: Date, hour?: number) => {
    if (!hasPermissions) return;
    
    const clickedDate = new Date(date);
    clickedDate.setHours(hour !== undefined ? hour : 9, 0, 0, 0);
    
    setDialogSelectedDate(clickedDate);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleAddEventClick = () => {
    console.log('🚀 Add Event clicked - hasPermissions:', hasPermissions);
    if (!hasPermissions) {
      console.log('❌ No permissions - returning early');
      return;
    }
    
    console.log('✅ Permissions ok - opening dialog');
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    
    setDialogSelectedDate(now);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  // Calendar navigation functions - identical to main dashboard
  const getDaysForView = () => {
    switch (view) {
      case "month": {
        const monthStart = startOfMonth(selectedDate);
        return eachDayOfInterval({
          start: monthStart,
          end: endOfMonth(selectedDate),
        });
      }
      case "week":
        return eachDayOfInterval({
          start: startOfWeek(selectedDate),
          end: endOfWeek(selectedDate),
        });
      case "day":
        return [startOfDay(selectedDate)];
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

  const handleViewChange = (newView: CalendarViewType) => {
    setView(newView);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load calendar events</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Mobile: Header centered with presence below */}
      <div className="block sm:hidden space-y-3">
        <h2 className="text-2xl font-bold text-foreground text-center">{t('dashboard.calendar')}</h2>
        <div className="flex items-center justify-center">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      {/* Desktop: Header with presence left aligned */}
      <div className="hidden sm:flex flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.calendar')}</h2>
        <div className="flex items-center gap-3">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      {/* Calendar Implementation - identical to main dashboard */}
      <div className={`h-full flex flex-col ${isMobile ? 'gap-2 -mx-4' : 'gap-4'}`}>
        <CalendarHeader
          selectedDate={selectedDate}
          view={view}
          onViewChange={handleViewChange}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onAddEvent={hasPermissions ? (() => {
            console.log('🚀 Add Event button clicked from CalendarHeader');
            handleAddEventClick();
          }) : undefined}
          isExternalCalendar={!hasPermissions}
        />

        <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
          {view !== 'month' && <TimeIndicator />}
          <div className={`flex-1 ${theme === "dark" ? "bg-gray-900" : "bg-white"} ${theme === "dark" ? "text-white" : "text-foreground"}`}>
            <CalendarView
              days={getDaysForView()}
              events={events || []}
              selectedDate={selectedDate}
              view={view}
              onDayClick={hasPermissions ? handleCalendarDayClick : undefined}
              onEventClick={handleEventClick}
              isExternalCalendar={!hasPermissions}
            />
          </div>
        </div>
      </div>

      {/* Event Dialogs - identical to main dashboard */}
      {hasPermissions && (
        <>
          <EventDialog
            key={dialogSelectedDate?.getTime()}
            open={isNewEventDialogOpen}
            onOpenChange={setIsNewEventDialogOpen}
            selectedDate={dialogSelectedDate}
            publicBoardUserId={boardUserId}
            externalUserName={externalUserName}
            isPublicMode={true}
            onEventCreated={async () => {
              queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
            }}
          />

          {selectedEvent && (
            <EventDialog
              key={selectedEvent.id}
              open={!!selectedEvent}
              onOpenChange={() => setSelectedEvent(null)}
              selectedDate={new Date(selectedEvent.start_date)}
              initialData={selectedEvent}
              publicBoardUserId={boardUserId}
              externalUserName={externalUserName}
              isPublicMode={true}
              onEventUpdated={async () => {
                queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
              }}
              onEventDeleted={async () => {
                queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
              }}
            />
          )}
        </>
      )}
    </div>
  );
};