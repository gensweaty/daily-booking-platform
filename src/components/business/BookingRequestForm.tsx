
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { formatDate, isSameDay } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

export interface BookingRequestFormProps {
  businessId: string;
  selectedDate: Date;
  startTime: string;
  endTime: string;
  onSuccess: () => void;
  isExternalBooking?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const BookingRequestForm = ({
  businessId,
  selectedDate,
  startTime,
  endTime,
  onSuccess,
  isExternalBooking = false,
  open,
  onOpenChange
}: BookingRequestFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<Date>(selectedDate);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const { t, language } = useLanguage();

  // For modal version
  const isDialog = open !== undefined && onOpenChange !== undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !date) {
      toast({
        title: t("common.error"),
        description: t("business.fillRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Format the start and end times to UTC ISO strings
      const startDateTime = new Date(date);
      const [startHours, startMinutes] = startTime.split(":").map(Number);
      startDateTime.setHours(startHours, startMinutes, 0, 0);

      const endDateTime = new Date(date);
      const [endHours, endMinutes] = endTime.split(":").map(Number);
      endDateTime.setHours(endHours, endMinutes, 0, 0);

      // Insert the booking request into the database
      const { error } = await supabase.from("booking_requests").insert({
        business_id: businessId,
        name,
        email,
        phone,
        notes,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: "pending",
        language, // Store the current language
      });

      if (error) throw error;

      // Call the Edge Function to send notification email
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-request-notification`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          businessId,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          notes,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          language, // Pass the current language
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error sending notification:", errorData);
        throw new Error("Failed to send notification email");
      }

      // Reset form and show success message
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setDate(selectedDate);

      toast({
        title: t("business.bookingRequestSent"),
        description: t("business.bookingRequestConfirmation"),
      });

      // Call the success callback
      onSuccess();

      // Close dialog if in dialog mode
      if (isDialog && onOpenChange) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error creating booking request:", error);
      toast({
        title: t("common.error"),
        description: t("business.bookingRequestError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          <LanguageText>{t("common.name")}</LanguageText> *
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          <LanguageText>{t("common.email")}</LanguageText> *
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">
          <LanguageText>{t("common.phone")}</LanguageText>
        </Label>
        <Input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">
          <LanguageText>{t("common.date")}</LanguageText> *
        </Label>
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
              disabled={isLoading}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDate(date)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(newDate) => {
                if (newDate) {
                  setDate(newDate);
                  setIsDatePickerOpen(false);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">
            <LanguageText>{t("common.startTime")}</LanguageText>
          </Label>
          <Input
            id="startTime"
            value={startTime}
            readOnly
            className="bg-muted"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">
            <LanguageText>{t("common.endTime")}</LanguageText>
          </Label>
          <Input
            id="endTime"
            value={endTime}
            readOnly
            className="bg-muted"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">
          <LanguageText>{t("common.notes")}</LanguageText>
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isLoading}
          rows={3}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        <LanguageText>
          {isLoading
            ? t("business.submittingRequest")
            : t("business.submitBookingRequest")}
        </LanguageText>
      </Button>
    </form>
  );

  // Return either a dialog or a regular form based on props
  if (isDialog) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <LanguageText>{t("business.bookTimeSlot")}</LanguageText>
            </DialogTitle>
          </DialogHeader>
          {FormContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="bg-card border rounded-lg shadow-sm p-4 md:p-6">
      <h3 className="text-lg font-semibold mb-4">
        <LanguageText>{t("business.bookTimeSlot")}</LanguageText>
      </h3>
      {FormContent}
    </div>
  );
};
