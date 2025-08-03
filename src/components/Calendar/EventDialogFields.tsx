import React, { useState } from "react";
import { CalendarEventType } from "@/lib/types/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { TaskDateTimePicker } from "@/components/tasks/TaskDateTimePicker";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

interface EventDialogFieldsProps {
  eventData: CalendarEventType;
  setEventData: (data: CalendarEventType) => void;
  onFileChange?: (file: File | null) => void;
  isEditing?: boolean;
  onClose?: () => void;
}

export const EventDialogFields: React.FC<EventDialogFieldsProps> = ({
  eventData,
  setEventData,
  onFileChange,
  isEditing = false,
  onClose,
}) => {
  const { t } = useLanguage();
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  const handleReminderToggle = (checked: boolean) => {
    setEventData({
      ...eventData,
      email_reminder_enabled: checked,
      reminder_at: checked ? eventData.reminder_at : undefined
    });
    
    if (checked && !eventData.reminder_at) {
      setShowReminderPicker(true);
    }
  };

  const handleReminderTimeSelect = (date: Date) => {
    setEventData({
      ...eventData,
      reminder_at: date.toISOString(),
      email_reminder_enabled: true
    });
    setShowReminderPicker(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="eventName">{t("calendar.eventName")}</Label>
          <Input
            id="eventName"
            placeholder={t("calendar.eventNamePlaceholder")}
            value={eventData.event_name || ""}
            onChange={(e) => setEventData({ ...eventData, event_name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="userSurname">{t("calendar.clientName")}</Label>
          <Input
            id="userSurname"
            placeholder={t("calendar.clientNamePlaceholder")}
            value={eventData.user_surname || ""}
            onChange={(e) => setEventData({ ...eventData, user_surname: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="userNumber">{t("calendar.phoneNumber")}</Label>
          <Input
            id="userNumber"
            placeholder={t("calendar.phoneNumberPlaceholder")}
            value={eventData.user_number || ""}
            onChange={(e) => setEventData({ ...eventData, user_number: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="socialNetworkLink">{t("calendar.email")}</Label>
          <Input
            id="socialNetworkLink"
            type="email"
            placeholder={t("calendar.emailPlaceholder")}
            value={eventData.social_network_link || ""}
            onChange={(e) => setEventData({ ...eventData, social_network_link: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">{t("calendar.startDateTime")}</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={eventData.start_date ? format(new Date(eventData.start_date), "yyyy-MM-dd'T'HH:mm") : ""}
            onChange={(e) => setEventData({ ...eventData, start_date: new Date(e.target.value).toISOString() })}
          />
        </div>
        <div>
          <Label htmlFor="endDate">{t("calendar.endDateTime")}</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={eventData.end_date ? format(new Date(eventData.end_date), "yyyy-MM-dd'T'HH:mm") : ""}
            onChange={(e) => setEventData({ ...eventData, end_date: new Date(e.target.value).toISOString() })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paymentStatus">{t("calendar.paymentStatus")}</Label>
          <Select
            value={eventData.payment_status || "not_paid"}
            onValueChange={(value) => setEventData({ ...eventData, payment_status: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("calendar.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">{t("calendar.notPaid")}</SelectItem>
              <SelectItem value="partly_paid">{t("calendar.partlyPaid")}</SelectItem>
              <SelectItem value="fully_paid">{t("calendar.fullyPaid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="paymentAmount">{t("calendar.paymentAmount")}</Label>
          <Input
            id="paymentAmount"
            type="number"
            placeholder="0.00"
            value={eventData.payment_amount || ""}
            onChange={(e) => setEventData({ ...eventData, payment_amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="eventNotes">{t("calendar.eventNotes")}</Label>
        <Textarea
          id="eventNotes"
          placeholder={t("calendar.eventNotesPlaceholder")}
          value={eventData.event_notes || ""}
          onChange={(e) => setEventData({ ...eventData, event_notes: e.target.value })}
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isRecurring"
            checked={eventData.is_recurring || false}
            onCheckedChange={(checked) => setEventData({ ...eventData, is_recurring: !!checked })}
          />
          <Label htmlFor="isRecurring" className="text-sm font-medium">
            {t("calendar.makeRecurring")}
          </Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="reminderEnabled"
            checked={eventData.email_reminder_enabled || false}
            onCheckedChange={handleReminderToggle}
          />
          <Label htmlFor="reminderEnabled" className="text-sm font-medium">
            {t("calendar.setReminder")}
          </Label>
        </div>
      </div>

      {eventData.email_reminder_enabled && eventData.reminder_at && (
        <div className="text-sm text-gray-600">
          {t("calendar.reminderSet")}: {format(new Date(eventData.reminder_at), "PPpp")}
        </div>
      )}

      {eventData.is_recurring && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="repeatPattern">{t("calendar.repeatPattern")}</Label>
            <Select
              value={eventData.repeat_pattern || "weekly"}
              onValueChange={(value) => setEventData({ ...eventData, repeat_pattern: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("calendar.selectRepeatPattern")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("calendar.daily")}</SelectItem>
                <SelectItem value="weekly">{t("calendar.weekly")}</SelectItem>
                <SelectItem value="biweekly">{t("calendar.biweekly")}</SelectItem>
                <SelectItem value="monthly">{t("calendar.monthly")}</SelectItem>
                <SelectItem value="yearly">{t("calendar.yearly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="repeatUntil">{t("calendar.repeatUntil")}</Label>
            <Input
              id="repeatUntil"
              type="date"
              value={eventData.repeat_until ? format(new Date(eventData.repeat_until), "yyyy-MM-dd") : ""}
              onChange={(e) => setEventData({ ...eventData, repeat_until: e.target.value })}
            />
          </div>
        </div>
      )}

      {onFileChange && (
        <div>
          <Label htmlFor="eventFile">{t("calendar.attachFile")}</Label>
          <FileUploadField
            onFileSelect={onFileChange}
            bucketName="event_attachments"
            accept="image/*,.pdf,.doc,.docx"
            maxSizeInMB={10}
          />
        </div>
      )}

      {showReminderPicker && (
        <TaskDateTimePicker
          isOpen={showReminderPicker}
          onClose={() => setShowReminderPicker(false)}
          onConfirm={handleReminderTimeSelect}
          initialDate={eventData.reminder_at ? new Date(eventData.reminder_at) : new Date()}
          title={t("calendar.setEventReminder")}
        />
      )}
    </div>
  );
};
