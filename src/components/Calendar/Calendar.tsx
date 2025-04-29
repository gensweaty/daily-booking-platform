import { useState, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, addHours } from "date-fns";
import { DayPicker } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EventDialog } from "./EventDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { BookingRequestForm } from "@/components/business/BookingRequestForm";
import { LanguageText } from "@/components/shared/LanguageText";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";

interface Props {
  className?: string;
}

// Renamed to DatePickerWithEvents to avoid name conflict with Calendar export
function DatePickerWithEvents({ className }: Props) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (date) {
      setSelectedDate(date);
    }
  }, [date]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date || null);
    setDate(date);
  };

  const handleAddEvent = () => {
    setShowEventDialog(true);
  };

  const handleSubmit = async (data: any): Promise<CalendarEventType> => {
    try {
      const { error, data: eventData } = await supabase
        .from("events")
        .insert({ ...data, user_id: user?.id })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: t('common.success'),
        description: t('events.eventCreated')
      });
      setShowEventDialog(false);
      
      // Return the created event data to satisfy the type requirement
      return eventData as CalendarEventType;
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleBookingRequest = (businessId: string) => {
    setSelectedBusinessId(businessId);
    setShowBookingForm(true);
  };

  return (
    <div className={cn("grid gap-6", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>{t("common.pickDate")}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarUI
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            disabled={(date) =>
              date < new Date()
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {user && (
        <Button onClick={handleAddEvent}>{t("events.addEvent")}</Button>
      )}

      {!user && (
        <Button onClick={() => handleBookingRequest(selectedBusinessId || "")}>
          {t("events.requestBooking")}
        </Button>
      )}

      <EventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        selectedDate={selectedDate}
        onSubmit={handleSubmit}
      />

      {showBookingForm && selectedBusinessId && (
        <BookingRequestForm
          businessId={selectedBusinessId}
          selectedDate={selectedDate}
          onSuccess={() => {
            setShowBookingForm(false);
            toast({
              title: t('booking.success'),
              description: t('booking.requestSubmitted')
            });
          }}
          onCancel={() => setShowBookingForm(false)}
          open={showBookingForm}
          onOpenChange={setShowBookingForm}
          startTime={format(new Date(), 'HH:mm')}
          endTime={format(addHours(new Date(), 1), 'HH:mm')}
          isExternalBooking={false}
        />
      )}
    </div>
  );
}

// Export both the DatePickerWithEvents component and the Calendar component
// that other files are trying to import
export { DatePickerWithEvents };
export { DatePickerWithEvents as Calendar };
