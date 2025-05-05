
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { LoaderCircle, CalendarIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface BookingRequestFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  businessId: string;
  startDate?: Date; // Changed to optional
  endDate?: Date;   // Changed to optional
  selectedDate?: Date; // Added to match Calendar component usage
  startTime?: string; // Added to match Calendar component usage
  endTime?: string;   // Added to match Calendar component usage
  disabled?: boolean;
  className?: string;
  open?: boolean;  // Added to match Calendar component usage
  onOpenChange?: (open: boolean) => void; // Added to match Calendar component usage
  onSuccess?: () => void; // Added to match Calendar component usage
  isExternalBooking?: boolean; // Added to match Calendar component usage
}

export const BookingRequestForm = ({
  onSubmit,
  onCancel,
  businessId,
  startDate: providedStartDate,
  endDate: providedEndDate,
  selectedDate,
  startTime,
  endTime,
  disabled = false,
  className,
  onSuccess,
  isExternalBooking,
}: BookingRequestFormProps) => {
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const isMobile = useMediaQuery("(max-width: 640px)");

  // Calculate start and end dates from the provided props
  const startDate = providedStartDate || (selectedDate ? new Date(selectedDate) : new Date());
  const endDate = providedEndDate || (() => {
    if (selectedDate && startTime && endTime) {
      const endDate = new Date(selectedDate);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      endDate.setHours(endHours || 0, endMinutes || 0, 0, 0);
      return endDate;
    }
    return new Date(startDate.getTime() + 60 * 60 * 1000); // Default to 1 hour later
  })();

  // Apply time if provided through startTime/endTime
  useEffect(() => {
    if (selectedDate && startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      startDate.setHours(hours || 0, minutes || 0, 0, 0);
    }
  }, [selectedDate, startTime]);

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"
  } : undefined;

  useEffect(() => {
    if (errorMessage) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: errorMessage,
      });
    }
  }, [errorMessage, toast, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!requesterName || !requesterEmail) {
      setErrorMessage(t("auth.requiredField"));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { data: businessProfile, error: businessError } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("id", businessId)
        .single();

      if (businessError) {
        console.error("Error fetching business profile:", businessError);
        setErrorMessage(t("common.errorOccurred"));
        return;
      }

      if (!businessProfile) {
        console.error("Business profile not found");
        setErrorMessage(t("common.errorOccurred"));
        return;
      }

      const bookingData = {
        business_id: businessId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        requester_name: requesterName,
        requester_phone: requesterPhone,
        requester_email: requesterEmail,
        description: description,
        status: "pending",
      };

      await onSubmit(bookingData);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error submitting booking request:", error);
      setErrorMessage(t("common.errorOccurred"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (date: Date) => {
    return format(date, "MMM dd, yyyy hh:mm a");
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div className="text-center mb-4">
        <h2 
          className={cn("text-xl font-semibold", isGeorgian ? "font-georgian" : "")} 
          style={georgianStyle}
        >
          <LanguageText>{t("events.submitBookingRequest")}</LanguageText>
        </h2>
      </div>

      <div className="grid gap-4">
        <div>
          <Label 
            htmlFor="name" 
            className={cn("required", isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            <LanguageText>{t("events.fullNameRequired")}</LanguageText>
          </Label>
          <Input
            id="name"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            required
            placeholder={t("events.fullName")}
            className={isGeorgian ? "font-georgian placeholder:font-georgian" : ""}
            style={georgianStyle}
          />
        </div>
        <div>
          <Label 
            htmlFor="phone" 
            className={isGeorgian ? "font-georgian" : ""}
            style={georgianStyle}
          >
            <LanguageText>{t("events.phoneNumber")}</LanguageText>
          </Label>
          <Input
            id="phone"
            value={requesterPhone}
            onChange={(e) => setRequesterPhone(e.target.value)}
            placeholder={t("events.phoneNumber")}
            className={isGeorgian ? "font-georgian placeholder:font-georgian" : ""}
            style={georgianStyle}
          />
        </div>
        <div>
          <Label 
            htmlFor="email" 
            className={cn("required", isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            <LanguageText>{t("events.socialLinkEmail")}</LanguageText>
          </Label>
          <Input
            id="email"
            type="email"
            value={requesterEmail}
            onChange={(e) => setRequesterEmail(e.target.value)}
            required
            placeholder="email@example.com"
          />
        </div>

        <div>
          <Label 
            htmlFor="date-time"
            className={cn("required", isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          >
            <LanguageText>{t("events.dateAndTime")}</LanguageText>
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="flex items-center">
                <CalendarIcon className="w-4 h-4 mr-2 opacity-70" />
                <span 
                  className={cn("text-sm text-muted-foreground", isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  <LanguageText>{t("events.start")}</LanguageText>
                </span>
              </div>
              <div className="border rounded p-2 bg-muted/30">
                {formatDateTime(startDate)}
              </div>
            </div>
            <div>
              <div className="flex items-center">
                <CalendarIcon className="w-4 h-4 mr-2 opacity-70" />
                <span 
                  className={cn("text-sm text-muted-foreground", isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                >
                  <LanguageText>{t("events.end")}</LanguageText>
                </span>
              </div>
              <div className="border rounded p-2 bg-muted/30">
                {formatDateTime(endDate)}
              </div>
            </div>
          </div>
        </div>

        <div>
          <Label 
            htmlFor="notes" 
            className={isGeorgian ? "font-georgian" : ""}
            style={georgianStyle}
          >
            <LanguageText>{t("events.eventNotes")}</LanguageText>
          </Label>
          {isMobile ? (
            <Textarea
              id="notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isGeorgian ? "დამატებითი კომენტარი თქვენი მოთხოვნის შესახებ" : t("events.addEventNotes")}
              className={isGeorgian ? "font-georgian placeholder:font-georgian min-h-[100px]" : "min-h-[100px]"}
              style={georgianStyle}
            />
          ) : (
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder={isGeorgian ? "დამატებითი კომენტარი თქვენი მოთხოვნის შესახებ" : t("events.addEventNotes")}
              className={isGeorgian ? "font-georgian" : ""}
            />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting || disabled}
          className={isGeorgian ? "font-georgian" : ""}
          style={georgianStyle}
        >
          <LanguageText>{t("common.cancel")}</LanguageText>
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || disabled}
          className={isGeorgian ? "font-georgian" : ""}
          style={georgianStyle}
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              <LanguageText>{t("common.submitting")}</LanguageText>
            </>
          ) : (
            <LanguageText>{t("events.submitRequest")}</LanguageText>
          )}
        </Button>
      </div>
      
      {errorMessage && (
        <div className="text-red-500 text-sm pt-2">{errorMessage}</div>
      )}
    </form>
  );
};
