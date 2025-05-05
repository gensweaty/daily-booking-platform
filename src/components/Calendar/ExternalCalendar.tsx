import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, startOfDay, endOfDay, parseISO, isAfter, isBefore, isEqual } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoaderCircle, Calendar as CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";
import { getGeorgianFontStyle } from "@/lib/font-utils";

interface ExternalCalendarProps {
  businessId: string;
}

export const ExternalCalendar: React.FC<ExternalCalendarProps> = ({ businessId }) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const navigate = useNavigate();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);
  const [businessData, setBusinessData] = useState<any>(null);

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const { data, error } = await supabase
          .from("business_profiles")
          .select("*")
          .eq("id", businessId)
          .single();

        if (error) {
          console.error("Error fetching business data:", error);
          return;
        }

        setBusinessData(data);
      } catch (err) {
        console.error("Error in fetchBusinessData:", err);
      }
    };

    fetchBusinessData();
  }, [businessId]);

  useEffect(() => {
    if (date) {
      fetchAvailableSlots(date);
    }
  }, [date, businessId]);

  const fetchAvailableSlots = async (selectedDate: Date) => {
    setLoadingSlots(true);
    try {
      const startDate = startOfDay(selectedDate);
      const endDate = endOfDay(selectedDate);

      // Fetch business hours for the selected day of week
      const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase();
      
      // Fetch available slots from the API
      const { data: availabilityData, error: availabilityError } = await supabase
        .from("business_availability")
        .select("*")
        .eq("business_id", businessId)
        .eq("day_of_week", dayOfWeek)
        .order("start_time");

      if (availabilityError) {
        console.error("Error fetching availability:", availabilityError);
        setAvailableSlots([]);
        setLoadingSlots(false);
        return;
      }

      // Fetch existing bookings for the selected date
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("business_id", businessId)
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString());

      if (bookingsError) {
        console.error("Error fetching bookings:", bookingsError);
        setAvailableSlots([]);
        setLoadingSlots(false);
        return;
      }

      // Generate available time slots based on business hours and existing bookings
      const slots = generateTimeSlots(selectedDate, availabilityData, bookingsData);
      setAvailableSlots(slots);
      
      // Update disabled dates based on business availability
      updateDisabledDates(availabilityData);
    } catch (error) {
      console.error("Error in fetchAvailableSlots:", error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
      setLoading(false);
    }
  };

  const updateDisabledDates = (availabilityData: any[]) => {
    // If no availability data, disable all dates
    if (!availabilityData || availabilityData.length === 0) {
      const allDates = Array.from({ length: 90 }, (_, i) => addDays(new Date(), i));
      setDisabledDates(allDates);
      return;
    }

    // Get days of week with no availability
    const availableDays = availabilityData.map(item => item.day_of_week.toLowerCase());
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const unavailableDayIndices = daysOfWeek
      .map((day, index) => availableDays.includes(day) ? -1 : index)
      .filter(index => index !== -1);

    // Generate dates for the next 90 days
    const nextNinetyDays = Array.from({ length: 90 }, (_, i) => addDays(new Date(), i));
    
    // Filter out dates that fall on unavailable days
    const disabledDates = nextNinetyDays.filter(date => {
      const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      return unavailableDayIndices.includes(dayIndex);
    });

    setDisabledDates(disabledDates);
  };

  const generateTimeSlots = (selectedDate: Date, availabilityData: any[], bookingsData: any[]) => {
    if (!availabilityData || availabilityData.length === 0) {
      return [];
    }

    const slots: any[] = [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Process each availability window
    availabilityData.forEach(availability => {
      const { start_time, end_time, slot_duration } = availability;
      
      // Convert start and end times to Date objects for the selected date
      const startDateTime = parseISO(`${dateStr}T${start_time}`);
      const endDateTime = parseISO(`${dateStr}T${end_time}`);
      
      // Generate slots based on duration
      let currentSlot = startDateTime;
      const durationMinutes = slot_duration || 60; // Default to 60 minutes if not specified
      
      while (isBefore(currentSlot, endDateTime) || isEqual(currentSlot, endDateTime)) {
        const slotEndTime = addDays(currentSlot, 0);
        slotEndTime.setMinutes(slotEndTime.getMinutes() + durationMinutes);
        
        if (isAfter(slotEndTime, endDateTime)) {
          break;
        }
        
        // Check if slot conflicts with existing bookings
        const isBooked = bookingsData?.some(booking => {
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);
          
          return (
            (isEqual(currentSlot, bookingStart) || isAfter(currentSlot, bookingStart)) &&
            isBefore(currentSlot, bookingEnd)
          ) || (
            isAfter(slotEndTime, bookingStart) &&
            (isBefore(slotEndTime, bookingEnd) || isEqual(slotEndTime, bookingEnd))
          );
        });
        
        if (!isBooked) {
          slots.push({
            start: format(currentSlot, 'HH:mm'),
            end: format(slotEndTime, 'HH:mm'),
            startISO: currentSlot.toISOString(),
            endISO: slotEndTime.toISOString(),
          });
        }
        
        // Move to next slot
        currentSlot = slotEndTime;
      }
    });

    return slots.sort((a, b) => a.start.localeCompare(b.start));
  };

  const handleSlotSelect = (slotStartISO: string) => {
    setSelectedSlot(slotStartISO);
  };

  const handleBookNow = () => {
    if (!selectedSlot || !businessId) return;
    
    const selectedSlotObj = availableSlots.find(slot => slot.startISO === selectedSlot);
    if (!selectedSlotObj) return;
    
    const bookingData = {
      businessId,
      businessName: businessData?.business_name || '',
      startTime: selectedSlotObj.startISO,
      endTime: selectedSlotObj.endISO,
      date: format(date!, 'yyyy-MM-dd'),
      timeSlot: `${selectedSlotObj.start} - ${selectedSlotObj.end}`,
    };
    
    // Store booking data in localStorage for the booking form
    localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
    
    // Navigate to booking form
    navigate(`/booking?business=${businessId}`);
  };

  const renderBookButton = () => {
    if (isGeorgian) {
      return (
        <Button 
          className="bg-primary text-white hover:bg-primary/90 georgian-text-fix"
          style={getGeorgianFontStyle()}
          disabled={!selectedSlot}
          onClick={handleBookNow}
        >
          დაჯავშნე ახლა
        </Button>
      );
    }
    
    return (
      <Button 
        className="bg-primary text-white hover:bg-primary/90"
        disabled={!selectedSlot}
        onClick={handleBookNow}
      >
        {t('calendar.bookNow')}
      </Button>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[350px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardContent className="p-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={[
              { before: new Date() },
              ...disabledDates
            ]}
            className="rounded-md border"
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className={cn(isGeorgian ? "georgian-text-fix" : "")}>
              <LanguageText>
                {date ? format(date, 'PPP') : t('calendar.pickDate')}
              </LanguageText>
            </span>
          </div>
          
          {loadingSlots ? (
            <div className="flex justify-center items-center h-40">
              <LoaderCircle className="h-6 w-6 animate-spin" />
            </div>
          ) : availableSlots.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableSlots.map((slot) => (
                <Button
                  key={slot.startISO}
                  variant={selectedSlot === slot.startISO ? "default" : "outline"}
                  className={cn(
                    "text-center justify-center",
                    selectedSlot === slot.startISO ? "bg-primary text-primary-foreground" : ""
                  )}
                  onClick={() => handleSlotSelect(slot.startISO)}
                >
                  {slot.start}
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <LanguageText>{t('calendar.noAvailableSlots')}</LanguageText>
            </div>
          )}
          
          <div className="mt-6 flex justify-end">
            {renderBookButton()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
