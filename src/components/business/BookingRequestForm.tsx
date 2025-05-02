import React, { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn, formatDate, isSameDay } from "@/lib/utils";

export interface BookingRequestFormProps {
  businessData?: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  businessId?: string;
  selectedDate?: Date;
  startTime?: string;
  endTime?: string;
  onSuccess?: () => void;
  isExternalBooking?: boolean;
}

export const BookingRequestForm = ({ 
  businessData, 
  open, 
  onOpenChange, 
  businessId: propBusinessId,
  selectedDate: initialDate,
  startTime: initialTime,
  endTime: initialEndTime,
  onSuccess,
  isExternalBooking
}: BookingRequestFormProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate || undefined);
  const [selectedTime, setSelectedTime] = useState(initialTime || "09:00");
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [businessEvents, setBusinessEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { slug } = useParams();
  const { t, language } = useLanguage();
  
  // Use either the prop businessId or the one from businessData
  const effectiveBusinessId = propBusinessId || businessData?.id;

  // Fetch business events on initial load
  useEffect(() => {
    const fetchBusinessEvents = async () => {
      if (!businessData?.user_id) return;
      
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase.rpc(
          'get_public_events_by_user_id',
          { user_id_param: businessData.user_id }
        );
        
        if (error) throw error;
        setBusinessEvents(data || []);
      } catch (error) {
        console.error("Error fetching business events:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBusinessEvents();
  }, [businessData?.user_id]);

  // Update available times when selected date changes
  useEffect(() => {
    if (!selectedDate) return;
    
    // Generate times from 9 AM to 5 PM
    const times = [];
    for (let hour = 9; hour <= 17; hour++) {
      times.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    
    // Filter out times that conflict with existing events
    const filteredTimes = times.filter(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + selectedDuration);
      
      // Check for conflicts with existing events
      return !businessEvents.some(event => {
        const eventStart = new Date(event.start_date);
        const eventEnd = new Date(event.end_date);
        
        return (
          isSameDay(eventStart, selectedDate) &&
          ((startTime >= eventStart && startTime < eventEnd) ||
           (endTime > eventStart && endTime <= eventEnd) ||
           (startTime <= eventStart && endTime >= eventEnd))
        );
      });
    });
    
    setAvailableTimes(filteredTimes);
    
    // Reset selected time if current selection is no longer available
    if (!filteredTimes.includes(selectedTime)) {
      setSelectedTime(filteredTimes[0] || "09:00");
    }
  }, [selectedDate, selectedDuration, businessEvents, selectedTime]);

  const getSelectedDateTime = () => {
    if (!selectedDate) return null;
    
    const dateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':').map(Number);
    dateTime.setHours(hours, minutes, 0, 0);
    
    return dateTime;
  };

  const getEndDateTime = () => {
    const startDate = getSelectedDateTime();
    if (!startDate) return null;
    
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + selectedDuration);
    
    return endDate;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !name || !email) {
      toast({
        title: t("common.error"),
        description: t("bookingForm.pleaseCompleteAllFields"),
        variant: "destructive",
      });
      return;
    }

    const startDate = getSelectedDateTime();
    const endDate = getEndDateTime();
    
    if (!startDate || !endDate) return;
    
    try {
      setIsSubmitting(true);
      
      // Determine which business ID to use
      const targetBusinessId = effectiveBusinessId || businessData?.id;
      
      if (!targetBusinessId) {
        throw new Error("No business ID available for booking");
      }
      
      // First, create the booking request in the database
      const { data: bookingData, error: bookingError } = await supabase
        .from('booking_requests')
        .insert({
          business_id: targetBusinessId,
          requester_name: name,
          requester_email: email,
          requester_phone: phone,
          description: notes,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          title: name,
          payment_status: 'not_paid',
          status: 'pending'
        })
        .select()
        .single();
        
      if (bookingError) throw bookingError;
      
      // Send email notification to business owner
      try {
        // Get business contact email if we don't have businessData yet
        let businessEmail = businessData?.contact_email;
        let businessName = businessData?.business_name;
        
        if (!businessEmail && targetBusinessId) {
          console.log("Fetching business details for business ID:", targetBusinessId);
          const { data: businessDetails, error: businessError } = await supabase
            .from('business_profiles')
            .select('business_name, contact_email')
            .eq('id', targetBusinessId)
            .single();
            
          if (businessError) {
            console.error("Error fetching business details:", businessError);
          } else if (businessDetails) {
            businessEmail = businessDetails.contact_email;
            businessName = businessDetails.business_name;
            console.log("Found business details:", businessDetails);
          }
        }
        
        if (!businessEmail) {
          console.warn("No business email available for notification");
          // Continue without sending email
        } else {
          console.log("Sending booking notification email to:", businessEmail);
          
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          
          if (!accessToken) {
            console.warn("No access token available for authenticated request, proceeding without authentication");
          }
          
          const headers: HeadersInit = {
            "Content-Type": "application/json"
          };
          
          if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
          }
          
          const response = await fetch(
            "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification",
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                businessEmail: businessEmail,
                businessName: businessName || "Your Business",
                requesterName: name,
                requesterEmail: email,
                requestDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                phoneNumber: phone,
                notes: notes,
                language: language
              }),
            }
          );
          
          const responseData = await response.json();
          
          if (!response.ok) {
            console.error("Error sending booking notification:", responseData);
          } else {
            console.log("Booking notification sent successfully:", responseData);
          }
        }
      } catch (emailError) {
        console.error("Error sending booking notification email:", emailError);
        // Continue with success flow even if email fails
      }
      
      toast({
        title: t("common.success"),
        description: t("bookingForm.bookingRequestSent"),
      });
      
      // Reset form fields
      setSelectedDate(undefined);
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Close dialog if applicable
      if (onOpenChange) {
        onOpenChange(false);
      }
      
    } catch (error) {
      console.error("Error submitting booking request:", error);
      toast({
        title: t("common.error"),
        description: t("bookingForm.errorSubmittingRequest"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl p-6 bg-card border rounded-lg shadow-sm">
      <h3 className="text-xl font-semibold mb-4">{t("bookingForm.title")}</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h4 className="font-medium">{t("bookingForm.selectDate")}</h4>
            <div className="border rounded-md overflow-hidden">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={{ before: new Date() }}
                className="rounded-md"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">{t("bookingForm.selectTime")}</h4>
              {selectedDate ? (
                <div className="grid grid-cols-3 gap-2">
                  {availableTimes.length > 0 ? (
                    availableTimes.map((time) => (
                      <Button
                        key={time}
                        type="button"
                        variant={selectedTime === time ? "default" : "outline"}
                        className={cn(
                          "h-9",
                          selectedTime === time && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => setSelectedTime(time)}
                      >
                        {time}
                      </Button>
                    ))
                  ) : (
                    <p className="col-span-3 text-sm text-muted-foreground">
                      {t("bookingForm.noTimesAvailable")}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("bookingForm.selectDateFirst")}
                </p>
              )}
            </div>
            
            <div>
              <h4 className="font-medium mb-2">{t("bookingForm.duration")}</h4>
              <div className="grid grid-cols-3 gap-2">
                {[30, 60, 90].map((duration) => (
                  <Button
                    key={duration}
                    type="button"
                    variant={selectedDuration === duration ? "default" : "outline"}
                    className={cn(
                      "h-9",
                      selectedDuration === duration && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => setSelectedDuration(duration)}
                  >
                    {duration} {t("bookingForm.minutes")}
                  </Button>
                ))}
              </div>
            </div>
            
            {selectedDate && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">{t("bookingForm.summary")}</p>
                <p className="text-sm">
                  {formatDate(selectedDate, language)}, {selectedTime} - {getEndDateTime()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                {t("bookingForm.name")} *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                {t("bookingForm.email")} *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">
              {t("bookingForm.phone")}
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              {t("bookingForm.notes")}
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>
        
        <Button 
          type="submit" 
          disabled={isSubmitting || !selectedDate || availableTimes.length === 0} 
          className="w-full"
        >
          {isSubmitting ? t("common.submitting") : t("bookingForm.submit")}
        </Button>
      </form>
    </div>
  );
};
