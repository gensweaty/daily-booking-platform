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
  
  // Calendar state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { theme } = useTheme();

  // Fetch events using RPC function for public access
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['publicCalendarEvents', boardUserId],
    queryFn: async () => {
      console.log('Fetching public calendar events for user:', boardUserId);
      const { data, error } = await supabase
        .rpc('get_public_events_by_user_id', { user_id_param: boardUserId });
      
      if (error) {
        console.error('Error fetching public calendar events:', error);
        throw error;
      }
      
      console.log('Fetched calendar events:', data);
      return (data || []) as CalendarEventType[];
    },
    enabled: !!boardUserId,
    refetchInterval: false,
  });

  // Calendar helper functions
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

  // Use the event dialog hook for managing events
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
    createEvent: hasPermissions !== false ? async (data) => {
      console.log('Creating event with sub-user metadata:', data);
      
      const { data: result, error } = await supabase
        .rpc('save_event_with_persons', {
          p_event_data: {
            ...data,
            created_by_type: 'sub_user',
            created_by_name: externalUserName,
            last_edited_by_type: 'sub_user',
            last_edited_by_name: externalUserName
          },
          p_additional_persons: [],
          p_user_id: boardUserId
        });

      if (error) throw error;
      
      toast({
        title: "Event created successfully",
        description: "Your event has been added to the calendar.",
      });
      
      return result;
    } : undefined,
    updateEvent: hasPermissions !== false ? async (data) => {
      console.log('Updating event with sub-user metadata:', data);
      
      const { data: result, error } = await supabase
        .rpc('save_event_with_persons', {
          p_event_data: {
            ...data,
            last_edited_by_type: 'sub_user',
            last_edited_by_name: externalUserName
          },
          p_additional_persons: [],
          p_user_id: boardUserId,
          p_event_id: data.id
        });

      if (error) throw error;
      
      toast({
        title: "Event updated successfully",
        description: "Your changes have been saved.",
      });
      
      return result;
    } : undefined,
    deleteEvent: hasPermissions ? async ({ id: eventId, deleteChoice }) => {
      console.log('Deleting event:', eventId);
      
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
      
      return result;
    } : undefined
  });

  const handleEventClick = (event: CalendarEventType) => {
    if (hasPermissions) {
      setSelectedEvent(event);
    } else {
      // For external users, just show toast that slot is booked
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
    console.log('🔍 Add Event clicked - hasPermissions:', hasPermissions);
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

  // Check if sub-user can edit/delete event
  const canEditEvent = (event: CalendarEventType) => {
    return event.created_by_type === 'sub_user' && event.created_by_name === externalUserName;
  };

  // Set up real-time subscription for calendar changes
  useEffect(() => {
    if (!boardUserId) return;

    console.log('Setting up real-time subscription for calendar events:', boardUserId);
    
    const channel = supabase
      .channel('public_calendar_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${boardUserId}`,
        },
        (payload) => {
          console.log('Real-time calendar change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
        }
      )
      .subscribe((status) => {
        console.log('Real-time calendar subscription status:', status);
      });

    return () => {
      console.log('Cleaning up real-time calendar subscription');
      supabase.removeChannel(channel);
    };
  }, [boardUserId, queryClient]);

  // Loading skeleton
  if (isLoading) {
    return (
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header skeleton */}
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="w-32 h-8 bg-muted rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="w-20 h-8 bg-muted rounded animate-pulse" />
          </div>
        </div>
        
        {/* Calendar skeleton */}
        <div className="space-y-4">
          <div className="h-10 w-full bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile: Header line with Calendar left, circles center */}
      <div className="grid sm:hidden grid-cols-[auto_1fr] items-center w-full">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.calendar')}</h2>
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

      {/* Custom Calendar Implementation */}
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

      {/* Event Dialogs for sub-users with permissions */}
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