
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { RecurringDeleteDialog } from "./RecurringDeleteDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

interface EventDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onOpenChange?: (open: boolean) => void;
  event?: CalendarEventType | null;
  initialData?: CalendarEventType;
  selectedDate?: Date;
  onSave?: (eventData: Partial<CalendarEventType>) => Promise<void>;
  onEventCreated?: () => Promise<void>;
  onEventUpdated?: () => Promise<void>;
  onDelete?: (eventId: string, deleteChoice?: "this" | "series") => Promise<void>;
  onEventDeleted?: (eventId: string, deleteChoice?: "this" | "series") => Promise<void>;
}

// CRITICAL FIX: Proper datetime-local format conversion
const formatDateForInput = (dateString: string | undefined): string => {
  if (!dateString) return "";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error("Error formatting date for input:", error);
    return "";
  }
};

export const EventDialog: React.FC<EventDialogProps> = ({
  open,
  isOpen,
  onClose,
  onOpenChange,
  event,
  initialData,
  selectedDate,
  onSave,
  onEventCreated,
  onEventUpdated,
  onDelete,
  onEventDeleted
}) => {
  const { t } = useLanguage();
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  
  // Determine if dialog should be open
  const dialogOpen = open !== undefined ? open : (isOpen !== undefined ? isOpen : false);
  
  // Use the provided event or initialData
  const currentEvent = event || initialData;
  
  // CRITICAL FIX: Initialize form data with ALL fields including reminders
  const [formData, setFormData] = useState<Partial<CalendarEventType>>({
    title: "",
    user_surname: "",
    user_number: "",
    social_network_link: "",
    event_notes: "",
    event_name: "",
    start_date: "",
    end_date: "",
    payment_status: "not_paid",
    payment_amount: undefined,
    type: "event",
    is_recurring: false,
    repeat_pattern: "",
    repeat_until: "",
    reminder_at: "", // CRITICAL: Initialize reminder fields
    email_reminder_enabled: false
  });

  // CRITICAL FIX: Properly initialize form data when event changes
  useEffect(() => {
    console.log("📝 EventDialog: Initializing form with event:", currentEvent);
    
    if (currentEvent) {
      // CRITICAL: Ensure ALL fields are properly initialized from the event
      setFormData({
        ...currentEvent,
        // CRITICAL: Proper reminder field initialization
        reminder_at: currentEvent.reminder_at ? formatDateForInput(currentEvent.reminder_at) : "",
        email_reminder_enabled: Boolean(currentEvent.email_reminder_enabled),
        // Ensure other datetime fields are properly formatted
        start_date: currentEvent.start_date ? formatDateForInput(currentEvent.start_date) : "",
        end_date: currentEvent.end_date ? formatDateForInput(currentEvent.end_date) : "",
        repeat_until: currentEvent.repeat_until || "",
        payment_amount: currentEvent.payment_amount || undefined,
      });
      
      console.log("📝 Form initialized with reminder fields:", {
        reminder_at: currentEvent.reminder_at,
        email_reminder_enabled: currentEvent.email_reminder_enabled,
        formatted_reminder_at: currentEvent.reminder_at ? formatDateForInput(currentEvent.reminder_at) : ""
      });
    } else if (selectedDate) {
      // Initialize for new event
      const startDateTime = new Date(selectedDate);
      const endDateTime = new Date(selectedDate);
      endDateTime.setHours(startDateTime.getHours() + 1);

      setFormData({
        title: "",
        user_surname: "",
        user_number: "",
        social_network_link: "",
        event_notes: "",
        event_name: "",
        start_date: formatDateForInput(startDateTime.toISOString()),
        end_date: formatDateForInput(endDateTime.toISOString()),
        payment_status: "not_paid",
        payment_amount: undefined,
        type: "event",
        is_recurring: false,
        repeat_pattern: "",
        repeat_until: "",
        reminder_at: "", // Empty for new events
        email_reminder_enabled: false
      });
    }
  }, [currentEvent, selectedDate]);

  const handleChange = (field: string, value: any) => {
    console.log(`📝 Field changed: ${field} = ${value}`);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      console.log("💾 Saving event with data:", formData);
      
      // Convert datetime-local back to ISO string for backend
      const eventData = {
        ...formData,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : "",
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : "",
        reminder_at: formData.reminder_at ? new Date(formData.reminder_at).toISOString() : null,
        repeat_until: formData.repeat_until || null,
      };
      
      console.log("💾 Processed event data for save:", eventData);
      
      if (onSave) {
        await onSave(eventData);
      } else if (onEventCreated && !currentEvent) {
        await onEventCreated();
      } else if (onEventUpdated && currentEvent) {
        await onEventUpdated();
      }
      
      if (onOpenChange) {
        onOpenChange(false);
      } else {
        onClose();
      }
    } catch (error) {
      console.error("❌ Error saving event:", error);
    }
  };

  const handleDelete = async () => {
    if (!currentEvent?.id) return;

    const deleteHandler = onDelete || onEventDeleted;
    if (!deleteHandler) return;

    if (currentEvent.is_recurring || currentEvent.parent_event_id) {
      setShowRecurringDeleteDialog(true);
    } else {
      await deleteHandler(currentEvent.id);
      if (onOpenChange) {
        onOpenChange(false);
      } else {
        onClose();
      }
    }
  };

  const handleRecurringDelete = async (deleteChoice: "this" | "series") => {
    if (!currentEvent?.id) return;
    
    const deleteHandler = onDelete || onEventDeleted;
    if (!deleteHandler) return;
    
    await deleteHandler(currentEvent.id, deleteChoice);
    setShowRecurringDeleteDialog(false);
    if (onOpenChange) {
      onOpenChange(false);
    } else {
      onClose();
    }
  };

  const handleDialogClose = () => {
    if (onOpenChange) {
      onOpenChange(false);
    } else {
      onClose();
    }
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {currentEvent ? t("calendar.editEvent") : t("calendar.createEvent")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <EventDialogFields
              title={formData.title || ""}
              setTitle={(value) => handleChange("title", value)}
              userSurname={formData.user_surname || ""}
              setUserSurname={(value) => handleChange("user_surname", value)}
              userNumber={formData.user_number || ""}
              setUserNumber={(value) => handleChange("user_number", value)}
              socialNetworkLink={formData.social_network_link || ""}
              setSocialNetworkLink={(value) => handleChange("social_network_link", value)}
              eventNotes={formData.event_notes || ""}
              setEventNotes={(value) => handleChange("event_notes", value)}
              eventName={formData.event_name || ""}
              setEventName={(value) => handleChange("event_name", value)}
              startDate={formData.start_date || ""}
              setStartDate={(value) => handleChange("start_date", value)}
              endDate={formData.end_date || ""}
              setEndDate={(value) => handleChange("end_date", value)}
              paymentStatus={formData.payment_status || "not_paid"}
              setPaymentStatus={(value) => handleChange("payment_status", value)}
              paymentAmount={formData.payment_amount?.toString() || ""}
              setPaymentAmount={(value) => handleChange("payment_amount", parseFloat(value) || undefined)}
              files={[]}
              setFiles={() => {}}
              existingFiles={[]}
              setExistingFiles={() => {}}
              eventId={currentEvent?.id}
              isRecurring={formData.is_recurring || false}
              setIsRecurring={(value) => handleChange("is_recurring", value)}
              repeatPattern={formData.repeat_pattern || ""}
              setRepeatPattern={(value) => handleChange("repeat_pattern", value)}
              repeatUntil={formData.repeat_until || ""}
              setRepeatUntil={(value) => handleChange("repeat_until", value)}
              isNewEvent={!currentEvent}
              additionalPersons={[]}
              setAdditionalPersons={() => {}}
              reminderAt={formData.reminder_at || ""}
              setReminderAt={(value) => handleChange("reminder_at", value)}
              emailReminderEnabled={formData.email_reminder_enabled || false}
              setEmailReminderEnabled={(value) => handleChange("email_reminder_enabled", value)}
            />

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="flex-1">
                {currentEvent ? t("common.update") : t("common.create")}
              </Button>
              
              {currentEvent && (onDelete || onEventDeleted) && (
                <Button variant="destructive" onClick={handleDelete}>
                  {t("common.delete")}
                </Button>
              )}
              
              <Button variant="outline" onClick={handleDialogClose}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        open={showRecurringDeleteDialog}
        onOpenChange={setShowRecurringDeleteDialog}
        onDeleteThis={() => handleRecurringDelete("this")}
        onDeleteSeries={() => handleRecurringDelete("series")}
        isRecurringEvent={true}
      />
    </>
  );
};
