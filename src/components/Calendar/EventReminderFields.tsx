
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Bell } from "lucide-react";
import { format, addHours } from "date-fns";

interface EventReminderFieldsProps {
  emailReminderEnabled: boolean;
  reminderAt?: string;
  eventStartDate: string;
  onReminderEnabledChange: (enabled: boolean) => void;
  onReminderAtChange: (reminderAt: string) => void;
}

export const EventReminderFields = ({
  emailReminderEnabled,
  reminderAt,
  eventStartDate,
  onReminderEnabledChange,
  onReminderAtChange,
}: EventReminderFieldsProps) => {
  const [localReminderAt, setLocalReminderAt] = useState<string>("");

  useEffect(() => {
    if (reminderAt) {
      // Convert UTC to local time for display
      const date = new Date(reminderAt);
      setLocalReminderAt(format(date, "yyyy-MM-dd'T'HH:mm"));
    } else if (emailReminderEnabled && eventStartDate) {
      // Default to 1 hour before event start
      const eventDate = new Date(eventStartDate);
      const defaultReminder = addHours(eventDate, -1);
      const formatted = format(defaultReminder, "yyyy-MM-dd'T'HH:mm");
      setLocalReminderAt(formatted);
      onReminderAtChange(defaultReminder.toISOString());
    }
  }, [reminderAt, emailReminderEnabled, eventStartDate, onReminderAtChange]);

  const handleReminderTimeChange = (value: string) => {
    setLocalReminderAt(value);
    if (value) {
      // Convert local time to UTC
      const localDate = new Date(value);
      onReminderAtChange(localDate.toISOString());
    }
  };

  const handleToggleChange = (checked: boolean) => {
    onReminderEnabledChange(checked);
    if (!checked) {
      setLocalReminderAt("");
      onReminderAtChange("");
    } else if (eventStartDate) {
      // Set default reminder time when enabling
      const eventDate = new Date(eventStartDate);
      const defaultReminder = addHours(eventDate, -1);
      const formatted = format(defaultReminder, "yyyy-MM-dd'T'HH:mm");
      setLocalReminderAt(formatted);
      onReminderAtChange(defaultReminder.toISOString());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <Switch
          id="email-reminder"
          checked={emailReminderEnabled}
          onCheckedChange={handleToggleChange}
        />
        <div className="flex items-center space-x-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="email-reminder" className="text-sm font-medium">
            Send email reminder
          </Label>
        </div>
      </div>

      {emailReminderEnabled && (
        <div className="ml-6 space-y-2">
          <Label htmlFor="reminder-time" className="text-sm text-muted-foreground">
            Reminder time
          </Label>
          <Input
            id="reminder-time"
            type="datetime-local"
            value={localReminderAt}
            onChange={(e) => handleReminderTimeChange(e.target.value)}
            className="w-full"
            min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
          />
        </div>
      )}
    </div>
  );
};
