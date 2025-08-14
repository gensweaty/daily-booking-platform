import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { CalendarHeader } from "../Calendar/CalendarHeader";
import { CalendarView } from "../Calendar/CalendarView";
import { EventDialog } from "../Calendar/EventDialog";
import { TimeIndicator } from "../Calendar/TimeIndicator";
import { useEventDialog } from "../Calendar/hooks/useEventDialog";
import { usePublicCalendarEvents } from "@/hooks/usePublicCalendarEvents";
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

  // Use the public calendar events hook - same pattern as dashboard
  const { events, isLoading, error, createEvent, updateEvent, deleteEvent } = usePublicCalendarEvents(
    boardUserId,
    externalUserName
  );

  // Use the event dialog hook - EXACT same pattern as dashboard
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
    deleteEvent: hasPermissions ? deleteEvent : undefined,
  });

  // Add debugging for event creation flow
  const debugCreateEvent = async (data: Partial<CalendarEventType>) => {
    console.log('[PublicCalendarList] 🎯 Debug create event called with:', data);
    try {
      const result = await handleCreateEvent(data);
      console.log('[PublicCalendarList] ✅ Debug create event success:', result);
      await handleEventCreated();
      return result;
    } catch (error) {
      console.error('[PublicCalendarList] ❌ Debug create event error:', error);
      throw error;
    }
  };

  const debugUpdateEvent = async (data: Partial<CalendarEventType>) => {
    console.log('[PublicCalendarList] 🎯 Debug update event called with:', data);
    try {
      const result = await handleUpdateEvent(data);
      console.log('[PublicCalendarList] ✅ Debug update event success:', result);
      await handleEventUpdated();
      return result;
    } catch (error) {
      console.error('[PublicCalendarList] ❌ Debug update event error:', error);
      throw error;
    }
  };

  const debugDeleteEvent = async (params: { id: string; deleteChoice?: "this" | "series" }) => {
    console.log('[PublicCalendarList] 🎯 Debug delete event called with:', params);
    try {
      const result = await handleDeleteEvent(params.deleteChoice);
      console.log('[PublicCalendarList] ✅ Debug delete event success:', result);
      await handleEventDeleted();
      return result;
    } catch (error) {
      console.error('[PublicCalendarList] ❌ Debug delete event error:', error);
      throw error;
    }
  };

  // Calendar helper functions - EXACT same as dashboard
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

  // Event handlers - EXACT same pattern as dashboard
  const handleCalendarDayClick = (date: Date, hour?: number) => {
    if (!hasPermissions) return;
    
    const clickedDate = new Date(date);
    clickedDate.setHours(hour !== undefined ? hour : 9, 0, 0, 0);
    
    setDialogSelectedDate(clickedDate);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

  const handleAddEventClick = () => {
    if (!hasPermissions) return;
    
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    
    setDialogSelectedDate(now);
    setTimeout(() => setIsNewEventDialogOpen(true), 0);
  };

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

  // Functions to handle event operations and refresh calendar - EXACT same as dashboard
  const refreshCalendar = async () => {
    const queryKey = ['publicCalendarEvents', boardUserId];
    
    // Wait a bit for database operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    queryClient.invalidateQueries({ queryKey });
  };

  const handleEventCreated = async () => {
    console.log("Event created, refreshing calendar...");
    await refreshCalendar();
  };

  const handleEventUpdated = async () => {
    console.log("Event updated, refreshing calendar...");
    await refreshCalendar();
  };

  const handleEventDeleted = async () => {
    console.log("Event deleted, refreshing calendar...");
    await refreshCalendar();
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

  // Error handling
  if (error) {
    console.error("Calendar error:", error);
    return <div className="text-red-500">Error loading calendar: {error.message}</div>;
  }

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

  const isDarkTheme = theme === "dark";
  const gridBgClass = isDarkTheme ? "bg-gray-900" : "bg-white";
  const textClass = isDarkTheme ? "text-white" : "text-foreground";

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

      {/* Calendar Implementation - EXACT same structure as dashboard */}
      <div className={`h-full flex flex-col ${isMobile ? 'gap-2 -mx-4' : 'gap-4'}`}>
        <CalendarHeader
          selectedDate={selectedDate}
          view={view}
          onViewChange={handleViewChange}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onAddEvent={hasPermissions ? handleAddEventClick : undefined}
          isExternalCalendar={!hasPermissions}
        />

        <div className={`flex-1 flex ${view !== 'month' ? 'overflow-hidden' : ''}`}>
          {view !== 'month' && <TimeIndicator />}
          <div className={`flex-1 ${gridBgClass} ${textClass}`}>
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

      {/* Event Dialogs - EXACT same pattern as dashboard */}
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
            onEventCreated={handleEventCreated}
            onSave={debugCreateEvent}
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
              onEventUpdated={handleEventUpdated}
              onEventDeleted={handleEventDeleted}
              onSave={debugUpdateEvent}
            />
          )}
        </>
      )}
    </div>
  );
};