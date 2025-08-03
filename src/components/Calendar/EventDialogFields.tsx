
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CalendarEventType } from "@/lib/types/calendar";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { EventReminderFields } from "./EventReminderFields";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventDialogFieldsProps {
  event: Partial<CalendarEventType>;
  onEventChange: (updates: Partial<CalendarEventType>) => void;
  onFileChange: (file: File | null) => void;
}

export const EventDialogFields = ({ event = {}, onEventChange, onFileChange }: EventDialogFieldsProps) => {
  const { t } = useLanguage();
  
  console.log('EventDialogFields received props:', { event, onEventChange, onFileChange });
  
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");

  useEffect(() => {
    if (event.start_date) {
      const date = new Date(event.start_date);
      const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setStartDateTime(localDateTime);
    }
  }, [event.start_date]);

  useEffect(() => {
    if (event.end_date) {
      const date = new Date(event.end_date);
      const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setEndDateTime(localDateTime);
    }
  }, [event.end_date]);

  const handleStartDateChange = (value: string) => {
    setStartDateTime(value);
    const utcDate = new Date(value).toISOString();
    onEventChange({ ...event, start_date: utcDate });
  };

  const handleEndDateChange = (value: string) => {
    setEndDateTime(value);
    const utcDate = new Date(value).toISOString();
    onEventChange({ ...event, end_date: utcDate });
  };

  const handleReminderEnabledChange = (enabled: boolean) => {
    onEventChange({
      ...event,
      email_reminder_enabled: enabled,
      reminder_at: enabled ? event.reminder_at : undefined,
    });
  };

  const handleReminderAtChange = (reminderAt: string) => {
    onEventChange({
      ...event,
      reminder_at: reminderAt,
    });
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="title" className="text-right">
          {t('calendar.title')}
        </Label>
        <Input
          id="title"
          value={event.user_surname || event.title || ""}
          onChange={(e) => onEventChange({ ...event, user_surname: e.target.value, title: e.target.value })}
          className="col-span-3"
        />
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="phone" className="text-right">
          {t('calendar.phone')}
        </Label>
        <Input
          id="phone"
          value={event.user_number || ""}
          onChange={(e) => onEventChange({ ...event, user_number: e.target.value })}
          className="col-span-3"
        />
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="email" className="text-right">
          {t('calendar.email')}
        </Label>
        <Input
          id="email"
          type="email"
          value={event.social_network_link || ""}
          onChange={(e) => onEventChange({ ...event, social_network_link: e.target.value })}
          className="col-span-3"
        />
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="start-date" className="text-right">
          {t('calendar.startDate')}
        </Label>
        <Input
          id="start-date"
          type="datetime-local"
          className="col-span-3"
          value={startDateTime}
          onChange={(e) => handleStartDateChange(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="end-date" className="text-right">
          {t('calendar.endDate')}
        </Label>
        <Input
          id="end-date"
          type="datetime-local"
          className="col-span-3"
          value={endDateTime}
          onChange={(e) => handleEndDateChange(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="payment-status" className="text-right">
          {t('calendar.paymentStatus')}
        </Label>
        <Select
          value={event.payment_status || "not_paid"}
          onValueChange={(value) => onEventChange({ ...event, payment_status: value })}
        >
          <SelectTrigger className="col-span-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_paid">{t('calendar.notPaid')}</SelectItem>
            <SelectItem value="partly_paid">{t('calendar.partlyPaid')}</SelectItem>
            <SelectItem value="fully_paid">{t('calendar.fullyPaid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="payment-amount" className="text-right">
          {t('calendar.paymentAmount')}
        </Label>
        <Input
          id="payment-amount"
          type="number"
          value={event.payment_amount || ""}
          onChange={(e) => onEventChange({ ...event, payment_amount: parseFloat(e.target.value) || null })}
          className="col-span-3"
        />
      </div>

      <div className="grid grid-cols-4 items-start gap-4">
        <Label htmlFor="notes" className="text-right pt-2">
          {t('calendar.notes')}
        </Label>
        <Textarea
          id="notes"
          value={event.event_notes || ""}
          onChange={(e) => onEventChange({ ...event, event_notes: e.target.value })}
          className="col-span-3"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-4 items-start gap-4">
        <Label className="text-right pt-2">
          {t('calendar.file')}
        </Label>
        <div className="col-span-3">
          <FileUploadField
            onFileChange={onFileChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 items-start gap-4">
        <div className="text-right pt-2">
          <Label className="text-sm font-medium">Reminders</Label>
        </div>
        <div className="col-span-3 space-y-4">
          <EventReminderFields
            emailReminderEnabled={event.email_reminder_enabled || false}
            reminderAt={event.reminder_at}
            eventStartDate={event.start_date || startDateTime}
            onReminderEnabledChange={handleReminderEnabledChange}
            onReminderAtChange={handleReminderAtChange}
          />

          <div className="flex items-center space-x-3">
            <Switch
              id="recurring"
              checked={event.is_recurring || false}
              onCheckedChange={(checked) => onEventChange({ ...event, is_recurring: checked })}
            />
            <Label htmlFor="recurring" className="text-sm font-medium">
              {t('calendar.makeRecurring')}
            </Label>
          </div>

          {event.is_recurring && (
            <div className="ml-6 space-y-4">
              <div>
                <Label htmlFor="repeat-pattern" className="text-sm text-muted-foreground">
                  {t('calendar.repeatPattern')}
                </Label>
                <Select
                  value={event.repeat_pattern || "weekly"}
                  onValueChange={(value) => onEventChange({ ...event, repeat_pattern: value })}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t('calendar.daily')}</SelectItem>
                    <SelectItem value="weekly">{t('calendar.weekly')}</SelectItem>
                    <SelectItem value="monthly">{t('calendar.monthly')}</SelectItem>
                    <SelectItem value="yearly">{t('calendar.yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="repeat-until" className="text-sm text-muted-foreground">
                  {t('calendar.repeatUntil')}
                </Label>
                <Input
                  id="repeat-until"
                  type="date"
                  value={event.repeat_until ? new Date(event.repeat_until).toISOString().split('T')[0] : ""}
                  onChange={(e) => onEventChange({ ...event, repeat_until: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full mt-1"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
