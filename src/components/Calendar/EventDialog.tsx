import { useState, useEffect } from "react";
import { format, addYears, endOfYear } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { CalendarEventType } from "@/lib/types/calendar";
import { cn } from "@/lib/utils";
import { FileRecord } from "@/types/files";
import { EventDialogFields } from "./EventDialogFields";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { generateRecurringInstances } from "@/lib/recurringEvents";

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  event?: CalendarEventType;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
  isBookingRequest?: boolean;
}

interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

export const EventDialog = ({
  isOpen,
  onClose,
  selectedDate,
  event,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
  isBookingRequest = false
}: EventDialogProps) => {
  
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayedFiles, setDisplayedFiles] = useState<FileRecord[]>([]);
  const [repeatPattern, setRepeatPattern] = useState("none");
  const [repeatUntil, setRepeatUntil] = useState<Date | undefined>(undefined);

  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const isNewEvent = !event;

  // Initialize form when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (event) {
        // Editing existing event
        setTitle(event.title || "");
        setUserSurname(event.user_surname || "");
        setUserNumber(event.user_number || "");
        setSocialNetworkLink(event.social_network_link || "");
        setEventNotes(event.event_notes || "");
        setEventName(event.event_name || "");
        setStartDate(event.start_date ? format(new Date(event.start_date), "yyyy-MM-dd'T'HH:mm") : "");
        setEndDate(event.end_date ? format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm") : "");
        setPaymentStatus(event.payment_status || "not_paid");
        setPaymentAmount(event.payment_amount?.toString() || "");
        setRepeatPattern(event.repeat_pattern || "none");
        setRepeatUntil(event.repeat_until ? new Date(event.repeat_until) : undefined);
      } else {
        // Creating new event
        const now = selectedDate || new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const currentYearEnd = endOfYear(now);
        
        setTitle("");
        setUserSurname("");
        setUserNumber("");
        setSocialNetworkLink("");
        setEventNotes("");
        setEventName("");
        setStartDate(format(now, "yyyy-MM-dd'T'HH:mm"));
        setEndDate(format(oneHourLater, "yyyy-MM-dd'T'HH:mm"));
        setPaymentStatus("not_paid");
        setPaymentAmount("");
        setRepeatPattern("none");
        setRepeatUntil(currentYearEnd); // Default to end of current year
      }
      
      setSelectedFile(null);
      setFileError("");
      setDisplayedFiles([]);
    }
  }, [isOpen, event, selectedDate]);

  const loadEventFiles = async (eventId: string) => {
    if (!eventId) return;

    try {
      const { data, error } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', eventId);

      if (error) {
        console.error("Error loading event files:", error);
        return;
      }

      setDisplayedFiles(data);
    } catch (error) {
      console.error("Error loading event files:", error);
    }
  };

  const handleFileDeleted = (fileId: string) => {
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const validateForm = () => {
    if (!userSurname.trim()) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "სრული სახელი აუცილებელია" : "Full name is required",
        variant: "destructive",
      });
      return false;
    }

    if (!startDate || !endDate) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error", 
        description: isGeorgian ? "დაწყების და დასრულების თარიღები აუცილებელია" : "Start and end dates are required",
        variant: "destructive",
      });
      return false;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "დასრულების თარიღი უნდა იყოს დაწყების თარიღის შემდეგ" : "End date must be after start date",
        variant: "destructive",
      });
      return false;
    }

    // Validate repeat until date
    if (repeatPattern !== "none" && repeatUntil && new Date(startDate) >= repeatUntil) {
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "განმეორების დასრულების თარიღი უნდა იყოს ღონისძიების დაწყების შემდეგ" : "Repeat until date must be after event start date",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get additional persons data from window
      const additionalPersonsData = (window as any).additionalPersonsData || [];

      // Prepare event data
      const eventData = {
        title: userSurname,
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes,
        event_name: eventName || null,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        payment_status: isBookingRequest ? "not_paid" : paymentStatus,
        payment_amount: paymentStatus === "not_paid" ? null : parseFloat(paymentAmount) || null,
        user_id: user.id,
        type: isBookingRequest ? 'booking_request' : 'event',
        is_recurring: repeatPattern !== "none",
        repeat_pattern: repeatPattern !== "none" ? repeatPattern : null,
        repeat_until: repeatPattern !== "none" && repeatUntil ? repeatUntil.toISOString() : null,
      };

      let savedEvent;

      if (event) {
        // Update existing event
        const { data, error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id)
          .select()
          .single();

        if (error) throw error;
        savedEvent = data;
      } else {
        // Create new event
        const { data, error } = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();

        if (error) throw error;
        savedEvent = data;
      }

      // Handle file upload if there's a selected file
      if (selectedFile && savedEvent) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${savedEvent.id}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile, {
            upsert: true
          });

        if (uploadError) {
          console.error("File upload error:", uploadError);
          toast({
            title: isGeorgian ? "გაფრთხილება" : "Warning",
            description: isGeorgian ? "ფაილი ვერ აიტვირთა" : "File could not be uploaded",
            variant: "destructive",
          });
        }
      }

      // Handle additional persons if any
      if (additionalPersonsData.length > 0) {
        const customersData = additionalPersonsData.map((person: any) => ({
          user_surname: person.userSurname,
          user_number: person.userNumber,
          social_network_link: person.socialNetworkLink,
          event_notes: person.eventNotes,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          payment_status: isBookingRequest ? "not_paid" : person.paymentStatus,
          payment_amount: person.paymentStatus === "not_paid" ? null : parseFloat(person.paymentAmount) || null,
          user_id: user.id,
          type: 'customer'
        }));

        const { error: customersError } = await supabase
          .from('customers')
          .insert(customersData);

        if (customersError) {
          console.error("Error saving additional persons:", customersError);
        }
      }

      toast({
        title: isGeorgian ? "წარმატება" : "Success",
        description: event 
          ? (isGeorgian ? "ღონისძიება განახლდა" : "Event updated successfully")
          : (isGeorgian ? "ღონისძიება შეიქმნა" : "Event created successfully"),
      });

      if (event) {
        onEventUpdated?.();
      } else {
        onEventCreated?.();
      }
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "ღონისძიების შენახვისას მოხდა შეცდომა" : "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: isGeorgian ? "წარმატება" : "Success",
        description: isGeorgian ? "ღონისძიება წაიშალა" : "Event deleted successfully",
      });

      onEventDeleted?.();
      onClose();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: isGeorgian ? "შეცდომა" : "Error",
        description: isGeorgian ? "ღონისძიების წაშლისას მოხდა შეცდომა" : "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {event 
              ? (isGeorgian ? <GeorgianAuthText>ღონისძიების რედაქტირება</GeorgianAuthText> : <LanguageText>{t("events.editEvent")}</LanguageText>)
              : (isBookingRequest 
                ? (isGeorgian ? <GeorgianAuthText>ჯავშნის მოთხოვნა</GeorgianAuthText> : <LanguageText>{t("booking.bookingRequest")}</LanguageText>)
                : (isGeorgian ? <GeorgianAuthText>ახალი ღონისძიება</GeorgianAuthText> : <LanguageText>{t("events.newEvent")}</LanguageText>)
              )
            }
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <EventDialogFields
            title={title}
            setTitle={setTitle}
            userSurname={userSurname}
            setUserSurname={setUserSurname}
            userNumber={userNumber}
            setUserNumber={setUserNumber}
            socialNetworkLink={socialNetworkLink}
            setSocialNetworkLink={setSocialNetworkLink}
            eventNotes={eventNotes}
            setEventNotes={setEventNotes}
            eventName={eventName}
            setEventName={setEventName}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            eventId={event?.id}
            displayedFiles={displayedFiles}
            onFileDeleted={handleFileDeleted}
            isBookingRequest={isBookingRequest}
            repeatPattern={repeatPattern}
            setRepeatPattern={setRepeatPattern}
            repeatUntil={repeatUntil}
            setRepeatUntil={setRepeatUntil}
            isNewEvent={isNewEvent}
          />
          
          <div className="flex justify-between pt-4">
            <div>
              {event && !isBookingRequest && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={loading}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className={cn(isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              >
                {isGeorgian ? <GeorgianAuthText>გაუქმება</GeorgianAuthText> : <LanguageText>{t("common.cancel")}</LanguageText>}
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className={cn(isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              >
                {loading 
                  ? (isGeorgian ? <GeorgianAuthText>მუშავდება...</GeorgianAuthText> : <LanguageText>{t("common.saving")}</LanguageText>)
                  : (event 
                    ? (isGeorgian ? <GeorgianAuthText>განახლება</GeorgianAuthText> : <LanguageText>{t("common.update")}</LanguageText>)
                    : (isGeorgian ? <GeorgianAuthText>შენახვა</GeorgianAuthText> : <LanguageText>{t("common.save")}</LanguageText>)
                  )
                }
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
