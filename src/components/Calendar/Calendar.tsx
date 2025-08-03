import React, { useState, useCallback } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EventDialog } from './EventDialog';
import { useOptimizedCalendarEvents } from '@/hooks/useOptimizedCalendarEvents';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarEventType } from '@/lib/types/calendar';
import { clearCalendarCache } from '@/services/calendarService';

interface Props {
  defaultView?: 'month' | 'week' | 'day';
}

export const CalendarComponent: React.FC<Props> = () => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  const { user } = useAuth();
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [month, setMonth] = useState(new Date());

  const { data: eventsData, refetch } = useOptimizedCalendarEvents(user?.id, month);
  const events = eventsData?.events || [];
  const bookingRequests = eventsData?.bookingRequests || [];

  const handleEventCreated = useCallback(async () => {
    console.log('[Calendar] Event created, refetching data...');
    clearCalendarCache();
    await refetch();
  }, [refetch]);

  const handleEventUpdated = useCallback(async () => {
    console.log('[Calendar] Event updated, refetching data...');
    clearCalendarCache();
    await refetch();
  }, [refetch]);

  const handleEventDeleted = useCallback(async () => {
    console.log('[Calendar] Event deleted, refetching data...');
    clearCalendarCache();
    await refetch();
  }, [refetch]);

  const prevMonth = useCallback(() => {
    setMonth(subMonths(month, 1));
  }, [month]);

  const nextMonth = useCallback(() => {
    setMonth(addMonths(month, 1));
  }, [month]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setEventDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEventType) => {
    setSelectedEvent(event);
    setSelectedDate(new Date(event.start_date));
  };

  const combinedEvents = [...events, ...bookingRequests];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-xl font-semibold">
          {isGeorgian
            ? format(month, 'MMMM yyyy', { locale: require('date-fns/locale/ka') })
            : format(month, 'MMMM yyyy')}
        </h1>
        <div className="flex items-center space-x-2">
          <Button onClick={prevMonth} variant="outline" className="h-8 w-8 p-0">
            <span className="sr-only">Previous month</span>
            <CalendarIcon className="h-4 w-4" />
          </Button>
          <Button onClick={nextMonth} variant="outline" className="h-8 w-8 p-0">
            <span className="sr-only">Next month</span>
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 relative">
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
              {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              defaultMonth={month}
              onMonthChange={setMonth}
            />
          </PopoverContent>
        </Popover>
        
        <div className="absolute top-0 left-0 w-full h-full p-4">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const day = format(addMonths(month, 0), 'E', { locale: language === 'ka' ? require('date-fns/locale/ka') : undefined });
              return (
                <div key={i} className="text-center text-xs font-medium uppercase text-muted-foreground">
                  {day}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 gap-1 mt-2">
            {Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => {
              const day = i + 1;
              const date = new Date(month.getFullYear(), month.getMonth(), day);
              const eventsForDay = combinedEvents.filter(event => {
                const eventDate = new Date(event.start_date);
                return eventDate.getDate() === day &&
                  eventDate.getMonth() === month.getMonth() &&
                  eventDate.getFullYear() === month.getFullYear();
              });

              return (
                <div
                  key={day}
                  className="relative h-10 w-10 flex items-center justify-center"
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-10 w-10 p-0 font-normal",
                      selectedDate?.getDate() === day &&
                      selectedDate?.getMonth() === month.getMonth() &&
                      selectedDate?.getFullYear() === month.getFullYear()
                        ? "bg-accent"
                        : "",
                      eventsForDay.length > 0 ? "text-blue-600" : ""
                    )}
                    onClick={() => handleDateSelect(date)}
                  >
                    {day}
                  </Button>
                  {eventsForDay.map(event => (
                    <Badge
                      key={event.id}
                      variant="secondary"
                      className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[0.6rem] cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEventClick(event);
                      }}
                    >
                      {event.title}
                    </Badge>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Event Dialog for creating new events */}
        <EventDialog
          key={selectedDate?.getTime() || 0}
          isOpen={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          selectedDate={selectedDate}
          onEventCreated={handleEventCreated}
        />

        {/* Event Dialog for editing existing events */}
        <EventDialog
          key={selectedEvent?.id || 'edit'}
          isOpen={!!selectedEvent}
          onOpenChange={() => setSelectedEvent(null)}
          selectedDate={selectedDate}
          initialData={selectedEvent}
          onEventUpdated={handleEventUpdated}
          onEventDeleted={handleEventDeleted}
        />
      </div>
    </div>
  );
};
