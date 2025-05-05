
import { useState, useEffect } from "react";
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
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarView } from "./CalendarView";
import { EventDialog } from "./EventDialog";
import { CalendarViewType, CalendarEventType } from "@/lib/types/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { TimeIndicator } from "./TimeIndicator";
import { useEventDialog } from "./hooks/useEventDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BookingRequestForm } from "../business/BookingRequestForm";
import { useToast } from "@/components/ui/use-toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface CalendarProps {
  defaultView?: CalendarViewType;
  currentView?: CalendarViewType;
  onViewChange?: (view: CalendarViewType) => void;
  isExternalCalendar?: boolean;
  businessId?: string;
  businessUserId?: string;
  showAllEvents?: boolean;
  allowBookingRequests?: boolean;
  directEvents?: CalendarEventType[];
}

const Calendar: React.FC<CalendarProps> = ({
  defaultView = "month",
  currentView: initialView,
  onViewChange,
  isExternalCalendar = false,
  businessId,
  businessUserId,
  showAllEvents = false,
  allowBookingRequests = false,
  directEvents,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(initialView || defaultView);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(
    null
  );
  const [isBookingRequestDialogOpen, setIsBookingRequestDialogOpen] =
    useState(false);
  const [isExternalBooking, setIsExternalBooking] = useState(false);
  const [bookingStartDate, setBookingStartDate] = useState<Date | null>(null);
  const [bookingEndDate, setBookingEndDate] = useState<Date | null>(null);
  const [bookingSelectedDate, setBookingSelectedDate] = useState<Date | null>(null);
  const [bookingStartTime, setBookingStartTime] = useState<string | null>(null);
  const [bookingEndTime, setBookingEndTime] = useState<string | null>(null);
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 640px)");

  const eventDialog = useEventDialog();

  useEffect(() => {
    if (onViewChange) {
      onViewChange(view);
    }
  }, [view, onViewChange]);

  useEffect(() => {
    if (directEvents) {
      setEvents(directEvents);
    }
  }, [directEvents]);

  const handleViewChange = (newView: CalendarViewType) => {
    setView(newView);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handlePrevious = () => {
    if (view === "month") {
      setSelectedDate((prevDate) => subMonths(prevDate, 1));
    } else if (view === "week") {
      setSelectedDate((prevDate) => addDays(prevDate, -7));
    } else if (view === "day") {
      setSelectedDate((prevDate) => addDays(prevDate, -1));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      setSelectedDate((prevDate) => addMonths(prevDate, 1));
    } else if (view === "week") {
      setSelectedDate((prevDate) => addDays(prevDate, 7));
    } else if (view === "day") {
      setSelectedDate((prevDate) => addDays(prevDate, 1));
    }
  };

  const {
    events: fetchedEvents,
    isLoading: isLoadingEvents,
    error,
  } = useCalendarEvents(
    selectedDate,
    view,
    user?.id || businessUserId,
    showAllEvents
  );

  useEffect(() => {
    setIsLoading(isLoadingEvents);
  }, [isLoadingEvents]);

  useEffect(() => {
    if (fetchedEvents) {
      setEvents(fetchedEvents);
    }
  }, [fetchedEvents]);

  useEffect(() => {
    if (error) {
      toast({
        title: t("common.error"),
        description: t("common.error"),
        variant: "destructive",
      });
    }
  }, [error, toast, t]);

  const handleAddEvent = () => {
    if (isExternalCalendar) {
      setIsExternalBooking(true);
      setIsBookingRequestDialogOpen(true);
      setBookingStartDate(startOfDay(selectedDate));
      setBookingEndDate(addDays(startOfDay(selectedDate), 1));
      setBookingSelectedDate(selectedDate);
    } else {
      setIsCreateDialogOpen(true);
    }
  };

  const handleEventClick = (event: CalendarEventType) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
    eventDialog.onOpen();
  };

  const handleCloseEventDialog = () => {
    setIsEventDialogOpen(false);
    eventDialog.onClose();
  };

  const handleBookingRequest = (
    startDate: Date,
    endDate: Date,
    selectedDate: Date,
    startTime: string,
    endTime: string
  ) => {
    setIsExternalBooking(true);
    setIsBookingRequestDialogOpen(true);
    setBookingStartDate(startDate);
    setBookingEndDate(endDate);
    setBookingSelectedDate(selectedDate);
    setBookingStartTime(startTime);
    setBookingEndTime(endTime);
  };

  const handleBookingSubmit = async (bookingData: any) => {
    try {
      const { data, error } = await supabase
        .from("booking_requests")
        .insert([bookingData])
        .select()
        .single();

      if (error) {
        console.error("Error creating booking request:", error);
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: t("common.errorOccurred"),
        });
        return;
      }

      toast({
        title: t("common.success"),
        description: t("events.bookingRequestSubmitted"),
      });

      setIsBookingRequestDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    } catch (error: any) {
      console.error("Error submitting booking request:", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("common.errorOccurred"),
      });
    }
  };

  const handleBookingCancel = () => {
    setIsBookingRequestDialogOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <CalendarHeader
        selectedDate={selectedDate}
        view={view}
        onViewChange={handleViewChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onAddEvent={allowBookingRequests ? handleAddEvent : undefined}
        isExternalCalendar={isExternalCalendar}
      />

      <div className="flex h-full">
        <TimeIndicator />
        <CalendarView
          selectedDate={selectedDate}
          view={view}
          events={events}
          days={[]} // CalendarView will compute days internally
          onDayClick={handleDateChange}
          onEventClick={handleEventClick}
          isExternalCalendar={isExternalCalendar}
          businessId={businessId}
          businessUserId={businessUserId}
          onBookingRequest={handleBookingRequest}
        />
      </div>

      <EventDialog
        open={isEventDialogOpen}
        onClose={handleCloseEventDialog}
        event={selectedEvent}
        isExternalCalendar={isExternalCalendar}
      />

      <Dialog open={isBookingRequestDialogOpen} onOpenChange={setIsBookingRequestDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <BookingRequestForm
            onSubmit={handleBookingSubmit}
            onCancel={handleBookingCancel}
            businessId={businessId || ""}
            startDate={bookingStartDate}
            endDate={bookingEndDate}
            selectedDate={bookingSelectedDate}
            startTime={bookingStartTime || undefined}
            endTime={bookingEndTime || undefined}
            onSuccess={() => setIsBookingRequestDialogOpen(false)}
            isExternalBooking={isExternalBooking}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Export the Calendar component as both default and named export
export { Calendar };
export default Calendar;
