
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { EventReminderFields } from "./EventReminderFields";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventDialogFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  eventNotes: string;
  setEventNotes: (value: string) => void;
  eventName: string;
  setEventName: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  repeatUntil: string;
  setRepeatUntil: (value: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  existingFiles: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
  setExistingFiles: (files: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>) => void;
  additionalPersons: Array<{
    id: string;
    userSurname: string;
    userNumber: string;
    socialNetworkLink: string;
    eventNotes: string;
    paymentStatus: string;
    paymentAmount: string;
  }>;
  setAdditionalPersons: (persons: Array<{
    id: string;
    userSurname: string;
    userNumber: string;
    socialNetworkLink: string;
    eventNotes: string;
    paymentStatus: string;
    paymentAmount: string;
  }>) => void;
  isVirtualEvent: boolean;
  isNewEvent: boolean;
}

export const EventDialogFields = ({
  title,
  setTitle,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  eventNotes,
  setEventNotes,
  eventName,
  setEventName,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isRecurring,
  setIsRecurring,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  files,
  setFiles,
  existingFiles,
  setExistingFiles,
  additionalPersons,
  setAdditionalPersons,
  isVirtualEvent,
  isNewEvent
}: EventDialogFieldsProps) => {
  const { t } = useLanguage();
  
  // Email reminder state - add these since they're not passed as props yet
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState("");

  const handleFileChange = (file: File | null) => {
    if (file) {
      setFiles([...files, file]);
    }
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="title" className="text-right">
          {t('calendar.title')}
        </Label>
        <Input
          id="title"
          value={userSurname || title || ""}
          onChange={(e) => {
            setUserSurname(e.target.value);
            setTitle(e.target.value);
          }}
          className="col-span-3"
        />
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="phone" className="text-right">
          {t('calendar.phone')}
        </Label>
        <Input
          id="phone"
          value={userNumber || ""}
          onChange={(e) => setUserNumber(e.target.value)}
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
          value={socialNetworkLink || ""}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
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
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
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
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="payment-status" className="text-right">
          {t('calendar.paymentStatus')}
        </Label>
        <Select
          value={paymentStatus || "not_paid"}
          onValueChange={(value) => setPaymentStatus(value)}
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
          value={paymentAmount || ""}
          onChange={(e) => setPaymentAmount(e.target.value)}
          className="col-span-3"
        />
      </div>

      <div className="grid grid-cols-4 items-start gap-4">
        <Label htmlFor="notes" className="text-right pt-2">
          {t('calendar.notes')}
        </Label>
        <Textarea
          id="notes"
          value={eventNotes || ""}
          onChange={(e) => setEventNotes(e.target.value)}
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
            onFileChange={handleFileChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 items-start gap-4">
        <div className="text-right pt-2">
          <Label className="text-sm font-medium">Reminders</Label>
        </div>
        <div className="col-span-3 space-y-4">
          <EventReminderFields
            emailReminderEnabled={emailReminderEnabled}
            reminderAt={reminderAt}
            eventStartDate={startDate}
            onReminderEnabledChange={setEmailReminderEnabled}
            onReminderAtChange={setReminderAt}
          />

          <div className="flex items-center space-x-3">
            <Switch
              id="recurring"
              checked={isRecurring || false}
              onCheckedChange={(checked) => setIsRecurring(checked)}
            />
            <Label htmlFor="recurring" className="text-sm font-medium">
              {t('calendar.makeRecurring')}
            </Label>
          </div>

          {isRecurring && (
            <div className="ml-6 space-y-4">
              <div>
                <Label htmlFor="repeat-pattern" className="text-sm text-muted-foreground">
                  {t('calendar.repeatPattern')}
                </Label>
                <Select
                  value={repeatPattern || "weekly"}
                  onValueChange={(value) => setRepeatPattern(value)}
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
                  value={repeatUntil ? new Date(repeatUntil).toISOString().split('T')[0] : ""}
                  onChange={(e) => setRepeatUntil(e.target.value ? new Date(e.target.value).toISOString() : "")}
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
