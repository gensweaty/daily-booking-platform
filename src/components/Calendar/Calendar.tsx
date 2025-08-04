import React, { useState, useEffect } from "react";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addMonths, format, isSameDay, subMonths } from "date-fns";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventDialog } from "./EventDialog";
import { useEventDialog } from "./hooks/useEventDialog";
import { useAuth } from "@/contexts/AuthContext";
import { getUnifiedCalendarEvents } from "@/services/calendarService";
import { useQuery } from "@tanstack/react-query";
import { LanguageText } from "@/components/shared/LanguageText";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventReminderNotifications } from "@/components/events/EventReminderNotifications";

interface CalendarProps {
  view: CalendarViewType;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onViewChange: (view: CalendarViewType) => void;
  onEventSelect?: (event: CalendarEventType) => void;
  businessId?: string;
}

export const Calendar = ({ 
  view, 
  selectedDate, 
  onDateSelect, 
  onViewChange,
  onEventSelect,
  businessId 
}: CalendarProps) => {
  const [date, setDate] = useState(selectedDate);
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();

  const {
    selectedEvent,
    setSelectedEvent,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    setSelectedDate,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = useEventDialog({});

  const { data: calendarEvents, isLoading } = useQuery({
    queryKey: ['events', user?.id, businessId],
    queryFn: () => getUnifiedCalendarEvents(businessId, user?.id),
    enabled: !!user?.id,
  });

  useEffect(() => {
    setDate(selectedDate);
  }, [selectedDate]);

  const handleDateSelect = (date: Date) => {
    setDate(date);
    onDateSelect(date);
  };

  const handleViewChange = (view: CalendarViewType) => {
    onViewChange(view);
  };

  const handleEventSelect = (event: CalendarEventType) => {
    setSelectedEvent(event);
    setIsNewEventDialogOpen(true);
    onEventSelect?.(event);
  };

  const handleNewEventClick = () => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setIsNewEventDialogOpen(true);
  };

  return (
    <>
      <EventReminderNotifications />
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <Popover open={isDatePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "MMMM yyyy") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <ShadcnCalendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setDate(subMonths(date, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setDate(addMonths(date, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={view} onValueChange={handleViewChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month"><LanguageText>common.month</LanguageText></SelectItem>
                <SelectItem value="week"><LanguageText>common.week</LanguageText></SelectItem>
                <SelectItem value="day"><LanguageText>common.day</LanguageText></SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleNewEventClick}><LanguageText>events.addEvent</LanguageText></Button>
          </div>
        </div>
        {isLoading ? (
          <div>Loading calendar events...</div>
        ) : (
          <ShadcnCalendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            className="rounded-md border"
            events={calendarEvents?.events}
            bookings={calendarEvents?.bookings}
            onEventSelect={handleEventSelect}
            view={view}
          />
        )}
      </div>

      <EventDialog
        open={isNewEventDialogOpen}
        onOpenChange={setIsNewEventDialogOpen}
        selectedDate={selectedDate}
        initialData={selectedEvent}
        onEventCreated={() => {}}
        onEventUpdated={() => {}}
        onEventDeleted={() => {}}
      />
    </>
  );
};
