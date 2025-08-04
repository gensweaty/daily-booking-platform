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
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEventType | null;
  onSave: (eventData: Partial<CalendarEventType>) => Promise<void>;
  onDelete?: (eventId: string, deleteChoice?: "this" | "series") => Promise<void>;
  selectedDate?: Date;
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
  isOpen,
  onClose,
  event,
  onSave,
  onDelete,
  selectedDate
}) => {
  const { t } = useLanguage();
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  
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
    console.log("📝 EventDialog: Initializing form with event:", event);
    
    if (event) {
      // CRITICAL: Ensure ALL fields are properly initialized from the event
      setFormData({
        ...event,
        // CRITICAL: Proper reminder field initialization
        reminder_at: event.reminder_at ? formatDateForInput(event.reminder_at) : "",
        email_reminder_enabled: Boolean(event.email_reminder_enabled),
        // Ensure other datetime fields are properly formatted
        start_date: event.start_date ? formatDateForInput(event.start_date) : "",
        end_date: event.end_date ? formatDateForInput(event.end_date) : "",
        repeat_until: event.repeat_until || "",
        payment_amount: event.payment_amount || undefined,
      });
      
      console.log("📝 Form initialized with reminder fields:", {
        reminder_at: event.reminder_at,
        email_reminder_enabled: event.email_reminder_enabled,
        formatted_reminder_at: event.reminder_at ? formatDateForInput(event.reminder_at) : ""
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
  }, [event, selectedDate]);

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
      
      await onSave(eventData);
      onClose();
    } catch (error) {
      console.error("❌ Error saving event:", error);
    }
  };

  const handleDelete = async () => {
    if (!event?.id || !onDelete) return;

    if (event.is_recurring || event.parent_event_id) {
      setShowRecurringDeleteDialog(true);
    } else {
      await onDelete(event.id);
      onClose();
    }
  };

  const handleRecurringDelete = async (deleteChoice: "this" | "series") => {
    if (!event?.id || !onDelete) return;
    
    await onDelete(event.id, deleteChoice);
    setShowRecurringDeleteDialog(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {event ? t("calendar.editEvent") : t("calendar.createEvent")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <EventDialogFields
              formData={formData}
              onChange={handleChange}
              isEditing={!!event}
            />

            {/* CRITICAL: Reminder Section - Always visible */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">{t("events.reminderSettings")}</h3>
              
              <div className="space-y-2">
                <Label htmlFor="reminder_at">{t("events.reminderTime")}</Label>
                <Input
                  id="reminder_at"
                  type="datetime-local"
                  value={formData.reminder_at || ""}
                  onChange={(e) => handleChange("reminder_at", e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="email_reminder_enabled"
                  checked={formData.email_reminder_enabled || false}
                  onCheckedChange={(checked) => handleChange("email_reminder_enabled", checked)}
                />
                <Label htmlFor="email_reminder_enabled">
                  {t("events.enableEmailReminder")}
                </Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="flex-1">
                {event ? t("common.update") : t("common.create")}
              </Button>
              
              {event && onDelete && (
                <Button variant="destructive" onClick={handleDelete}>
                  {t("common.delete")}
                </Button>
              )}
              
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RecurringDeleteDialog
        isOpen={showRecurringDeleteDialog}
        onClose={() => setShowRecurringDeleteDialog(false)}
        onConfirm={handleRecurringDelete}
      />
    </>
  );
};
