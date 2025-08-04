import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { Calendar as CalendarIcon } from "lucide-react";
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, isSameMonth, isSameDay, subMonths, addMonths, isPast } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EventDialog } from "./EventDialog";
import { CalendarEvent } from '@/lib/types';
import { useOptimizedCalendarEvents } from '@/hooks/useOptimizedCalendarEvents';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'inprogress' | 'done';
  created_at: string;
  updated_at?: string;
  user_id?: string;
  position: number;
  deadline_at?: string;
  reminder_at?: string;
  archived?: boolean;
  archived_at?: string;
  email_reminder_enabled?: boolean;
  reminder_sent_at?: string;
}

export const CalendarComponent = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const {
    data: calendarData,
    isLoading,
    refetch: refetchEvents,
  } = useOptimizedCalendarEvents(user?.id, selectedDate);

  const events = calendarData?.events || [];
  const bookingRequests = calendarData?.bookingRequests || [];

  const refreshEvents = useCallback(async () => {
    await refetchEvents();
  }, [refetchEvents]);

  useEffect(() => {
    if (!isLoading) {
      console.log('Events loaded:', events);
      console.log('Booking Requests loaded:', bookingRequests);
    }
  }, [events, bookingRequests, isLoading]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setIsCreateDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEditDialogOpen(true);
  };

  const getDayEvents = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    return events.filter(
      (event) =>
        format(new Date(event.start_date), 'yyyy-MM-dd') <= formattedDate &&
        format(new Date(event.end_date), 'yyyy-MM-dd') >= formattedDate
    );
  };

  const getDayBookingRequests = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    return bookingRequests.filter(
      (booking) =>
        format(new Date(booking.start_date), 'yyyy-MM-dd') <= formattedDate &&
        format(new Date(booking.end_date), 'yyyy-MM-dd') >= formattedDate
    );
  };

  const handlePrevMonth = () => {
    setSelectedDate(subMonths(selectedDate, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(addMonths(selectedDate, 1));
  };

  const handleCreateEvent = async (eventData: Partial<CalendarEvent>) => {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create event');
    }
    
    return response.json();
  };

  const handleUpdateEvent = async (eventData: Partial<CalendarEvent>) => {
    const response = await fetch(`/api/events/${eventData.id}`, {
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to update event');
    }
    
    return response.json();
  };

  return (
    <div className="calendar-container">
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "MMMM yyyy") : t("common.pickDate")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button onClick={handlePrevMonth}>{t("common.previous")}</Button>
          <Button onClick={handleNextMonth}>{t("common.next")}</Button>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>{t("events.newEvent")}</Button>
      </div>

      <div className="border rounded-md shadow-sm">
        <div className="grid grid-cols-7">
          {/* Weekday headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <div key={index} className="p-2 text-center border-b font-semibold">{day}</div>
          ))}

          {/* Calendar days */}
          {Array.from({ length: 42 }).map((_, index) => {
            const day = addDays(startOfWeek(startOfMonth(selectedDate)), index);
            const isCurrentMonth = isSameMonth(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const dayEvents = getDayEvents(day);
            const dayBookingRequests = getDayBookingRequests(day);
            const isDisabled = isPast(day) && !isToday;

            return (
              <div
                key={index}
                className={cn(
                  "p-2 text-center border-b border-r relative",
                  !isCurrentMonth && "text-gray-400",
                  isToday && "font-bold",
                  isDisabled && "opacity-50 cursor-not-allowed",
                  "hover:bg-gray-100 transition-colors duration-200",
                )}
                onClick={() => !isDisabled && handleDateSelect(day)}
              >
                <span className="absolute top-1 left-1">{format(day, 'd')}</span>
                {dayEvents.length > 0 && (
                  <div className="mt-4">
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="bg-blue-200 text-blue-800 rounded-full px-2 py-1 text-xs mt-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                )}
                {dayBookingRequests.length > 0 && (
                  <div className="mt-4">
                    {dayBookingRequests.map((booking) => (
                      <div
                        key={booking.id}
                        className="bg-green-200 text-green-800 rounded-full px-2 py-1 text-xs mt-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Assuming you want to open the event dialog for booking requests as well
                          // You might need to adjust this part based on your requirements
                          // handleEventClick(booking); 
                        }}
                      >
                        {booking.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <EventDialog
        key={isCreateDialogOpen ? 1 : 0}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        selectedDate={selectedDate}
        onSave={handleCreateEvent}
        onEventCreated={refreshEvents}
      />

      {selectedEvent && (
        <EventDialog
          key={selectedEvent.id}
          open={isEditDialogOpen}
          onOpenChange={() => setIsEditDialogOpen(false)}
          selectedDate={selectedDate}
          initialData={selectedEvent}
          onSave={handleUpdateEvent}
          onEventUpdated={refreshEvents}
          onEventDeleted={refreshEvents}
        />
      )}
    </div>
  );
};

// Export as Calendar for compatibility with existing imports
export { CalendarComponent as Calendar };
