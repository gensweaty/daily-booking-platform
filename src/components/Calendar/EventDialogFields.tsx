
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarEventType } from "@/lib/types/calendar";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";
import { TaskDateTimePicker } from "@/components/tasks/TaskDateTimePicker";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventDialogFieldsProps {
  eventData: Partial<CalendarEventType>;
  onDataChange: (field: keyof CalendarEventType, value: any) => void;
  onFileSelect: (file: File) => void;
  onDeleteFile: () => void;
}

export const EventDialogFields: React.FC<EventDialogFieldsProps> = ({
  eventData,
  onDataChange,
  onFileSelect,
  onDeleteFile,
}) => {
  const { t } = useLanguage();
  const [isReminderPickerOpen, setIsReminderPickerOpen] = React.useState(false);

  const handleReminderTimeConfirm = (date: Date) => {
    onDataChange('reminder_at', date);
    setIsReminderPickerOpen(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="event_name">{t("events.eventName")}</Label>
        <Input
          id="event_name"
          value={eventData.event_name || ""}
          onChange={(e) => onDataChange('event_name', e.target.value)}
          placeholder={t("events.eventNamePlaceholder")}
        />
      </div>

      <div>
        <Label htmlFor="client_name">{t("events.clientName")}</Label>
        <Input
          id="client_name"
          value={eventData.client_name || ""}
          onChange={(e) => onDataChange('client_name', e.target.value)}
          placeholder={t("events.clientNamePlaceholder")}
        />
      </div>

      <div>
        <Label htmlFor="phone_number">{t("events.phoneNumber")}</Label>
        <Input
          id="phone_number"
          value={eventData.phone_number || ""}
          onChange={(e) => onDataChange('phone_number', e.target.value)}
          placeholder={t("events.phoneNumberPlaceholder")}
        />
      </div>

      <div>
        <Label htmlFor="social_network_link">{t("events.socialNetworkLink")}</Label>
        <Input
          id="social_network_link"
          value={eventData.social_network_link || ""}
          onChange={(e) => onDataChange('social_network_link', e.target.value)}
          placeholder={t("events.socialNetworkLinkPlaceholder")}
        />
      </div>

      <div>
        <Label htmlFor="description">{t("events.description")}</Label>
        <Textarea
          id="description"
          value={eventData.description || ""}
          onChange={(e) => onDataChange('description', e.target.value)}
          placeholder={t("events.descriptionPlaceholder")}
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="payment_amount">{t("events.paymentAmount")}</Label>
        <Input
          id="payment_amount"
          type="number"
          step="0.01"
          value={eventData.payment_amount || ""}
          onChange={(e) => onDataChange('payment_amount', parseFloat(e.target.value) || 0)}
          placeholder="0.00"
        />
      </div>

      <div>
        <Label htmlFor="payment_status">{t("events.paymentStatus")}</Label>
        <Select
          value={eventData.payment_status || "pending"}
          onValueChange={(value) => onDataChange('payment_status', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{t("events.paymentStatusPending")}</SelectItem>
            <SelectItem value="paid">{t("events.paymentStatusPaid")}</SelectItem>
            <SelectItem value="cancelled">{t("events.paymentStatusCancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="recurring"
            checked={eventData.is_recurring || false}
            onCheckedChange={(checked) => onDataChange('is_recurring', checked)}
          />
          <Label htmlFor="recurring" className="text-sm">
            {t("events.makeRecurring")}
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="email_reminder"
            checked={eventData.email_reminder_enabled || false}
            onCheckedChange={(checked) => {
              onDataChange('email_reminder_enabled', checked);
              if (checked) {
                setIsReminderPickerOpen(true);
              } else {
                onDataChange('reminder_at', null);
              }
            }}
          />
          <Label htmlFor="email_reminder" className="text-sm">
            {t("events.setEventReminder")}
          </Label>
        </div>
      </div>

      <div>
        <Label>{t("events.attachment")}</Label>
        {eventData.attachment ? (
          <SimpleFileDisplay
            fileName={eventData.attachment}
            onDelete={onDeleteFile}
          />
        ) : (
          <FileUploadField
            onFileSelect={onFileSelect}
            accept="image/*,.pdf,.doc,.docx"
            maxSizeInMB={5}
          />
        )}
      </div>

      {isReminderPickerOpen && (
        <TaskDateTimePicker
          open={isReminderPickerOpen}
          onClose={() => setIsReminderPickerOpen(false)}
          onConfirm={handleReminderTimeConfirm}
          initialDate={eventData.reminder_at ? new Date(eventData.reminder_at) : new Date()}
          title={t("events.setEventReminder")}
        />
      )}
    </div>
  );
};
