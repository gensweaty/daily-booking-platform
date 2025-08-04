import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { X, Upload, Bell } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PaymentStatus } from "@/lib/types";

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
  setPaymentStatus: (value: PaymentStatus) => void;
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
  isVirtualEvent?: boolean;
  isNewEvent?: boolean;
  reminderAt: string;
  setReminderAt: (value: string) => void;
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (value: boolean) => void;
}

// Helper functions for timezone conversion
const localToUTC = (localStr: string): string => {
  if (!localStr) return '';
  return new Date(localStr).toISOString();
};

const utcToLocal = (isoStr: string): string => {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const getNow = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

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
  isVirtualEvent = false,
  isNewEvent = false,
  reminderAt,
  setReminderAt,
  emailReminderEnabled,
  setEmailReminderEnabled,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();

  const handleReminderTimeChange = (value: string) => {
    if (!value) {
      setReminderAt('');
      return;
    }

    // Validate that reminder time is before start time
    if (startDate && new Date(value) >= new Date(startDate)) {
      // Show validation error but still set the value for user to see the issue
      setReminderAt(value);
      return;
    }

    setReminderAt(value);
  };

  const getDefaultReminderTime = (): string => {
    if (!startDate) return '';
    const eventStart = new Date(startDate);
    eventStart.setHours(eventStart.getHours() - 1); // Default to 1 hour before
    return eventStart.toISOString().slice(0, 16);
  };

  const handleEmailReminderChange = (checked: boolean) => {
    setEmailReminderEnabled(checked);
    if (checked && !reminderAt) {
      setReminderAt(getDefaultReminderTime());
    } else if (!checked) {
      setReminderAt('');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles([...files, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const removeExistingFile = async (fileId: string) => {
    setExistingFiles(existingFiles.filter(file => file.id !== fileId));
  };

  const addPerson = () => {
    const newPerson = {
      id: Date.now().toString(),
      userSurname: '',
      userNumber: '',
      socialNetworkLink: '',
      eventNotes: '',
      paymentStatus: '',
      paymentAmount: ''
    };
    setAdditionalPersons([...additionalPersons, newPerson]);
  };

  const removePerson = (id: string) => {
    setAdditionalPersons(additionalPersons.filter(person => person.id !== id));
  };

  const updatePerson = (id: string, field: string, value: string) => {
    setAdditionalPersons(additionalPersons.map(person => 
      person.id === id ? { ...person, [field]: value } : person
    ));
  };

  return (
    <div className="space-y-6">
      {/* Basic Event Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">{t("events.eventTitle")}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("events.eventTitlePlaceholder")}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="userSurname">{t("events.customerName")}</Label>
          <Input
            id="userSurname"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
            placeholder={t("events.customerNamePlaceholder")}
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="userNumber">{t("events.phoneNumber")}</Label>
          <Input
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            placeholder={t("events.phoneNumberPlaceholder")}
          />
        </div>
        
        <div>
          <Label htmlFor="socialNetworkLink">{t("events.email")}</Label>
          <Input
            id="socialNetworkLink"
            type="email"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            placeholder={t("events.emailPlaceholder")}
          />
        </div>
      </div>

      {/* Event Details */}
      <div>
        <Label htmlFor="eventNotes">{t("events.eventNotes")}</Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder={t("events.eventNotesPlaceholder")}
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="eventName">{t("events.eventType")}</Label>
        <Input
          id="eventName"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder={t("events.eventTypePlaceholder")}
        />
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">{t("events.startDate")}</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="endDate">{t("events.endDate")}</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Payment Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paymentStatus">{t("events.paymentStatus")}</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger>
              <SelectValue placeholder={t("events.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
              <SelectItem value="partly_paid">{t("events.partlyPaid")}</SelectItem>
              <SelectItem value="fully_paid">{t("events.fullyPaid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="paymentAmount">{t("events.paymentAmount")}</Label>
          <Input
            id="paymentAmount"
            type="number"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Recurring Event Options */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isRecurring"
            checked={isRecurring}
            onCheckedChange={setIsRecurring}
            disabled={isVirtualEvent}
          />
          <Label htmlFor="isRecurring" className="text-sm font-medium">
            {t("events.makeRecurring")}
          </Label>
        </div>

        {/* Email Reminder Checkbox - positioned next to recurring checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="emailReminder"
            checked={emailReminderEnabled}
            onCheckedChange={handleEmailReminderChange}
          />
          <Label htmlFor="emailReminder" className="text-sm font-medium flex items-center gap-1">
            <Bell className="h-4 w-4" />
            Email Reminder
          </Label>
        </div>

        {/* Email Reminder Time Input */}
        {emailReminderEnabled && (
          <div className="ml-6">
            <Label htmlFor="reminderAt" className="text-sm">
              Reminder Time
            </Label>
            <Input
              id="reminderAt"
              type="datetime-local"
              min={getNow()}
              max={startDate}
              value={reminderAt}
              onChange={(e) => handleReminderTimeChange(e.target.value)}
              required
              className={
                reminderAt && startDate && new Date(reminderAt) >= new Date(startDate)
                  ? "border-red-500"
                  : ""
              }
            />
            {reminderAt && startDate && new Date(reminderAt) >= new Date(startDate) && (
              <p className="text-sm text-red-500 mt-1">
                Reminder time must be before the event start time
              </p>
            )}
          </div>
        )}

        {isRecurring && (
          <div className="space-y-4 ml-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="repeatPattern">{t("events.repeatPattern")}</Label>
                <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("events.selectPattern")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t("events.daily")}</SelectItem>
                    <SelectItem value="weekly">{t("events.weekly")}</SelectItem>
                    <SelectItem value="monthly">{t("events.monthly")}</SelectItem>
                    <SelectItem value="yearly">{t("events.yearly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="repeatUntil">{t("events.repeatUntil")}</Label>
                <Input
                  id="repeatUntil"
                  type="date"
                  value={repeatUntil}
                  onChange={(e) => setRepeatUntil(e.target.value)}
                  required={isRecurring}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File Upload Section */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="fileUpload">{t("events.attachFiles")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="fileUpload"
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('fileUpload')?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {t("events.chooseFiles")}
            </Button>
          </div>
        </div>

        {/* Display uploaded files */}
        {files.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("events.newFiles")}</Label>
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Display existing files */}
        {existingFiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("events.existingFiles")}</Label>
            {existingFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm truncate">{file.filename}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeExistingFile(file.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Additional Persons Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">{t("events.additionalPersons")}</Label>
          <Button type="button" variant="outline" onClick={addPerson}>
            {t("events.addPerson")}
          </Button>
        </div>

        {additionalPersons.map((person) => (
          <div key={person.id} className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t("events.person")} #{person.id}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removePerson(person.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">{t("events.customerName")}</Label>
                <Input
                  value={person.userSurname}
                  onChange={(e) => updatePerson(person.id, 'userSurname', e.target.value)}
                  placeholder={t("events.customerNamePlaceholder")}
                />
              </div>
              
              <div>
                <Label className="text-sm">{t("events.phoneNumber")}</Label>
                <Input
                  value={person.userNumber}
                  onChange={(e) => updatePerson(person.id, 'userNumber', e.target.value)}
                  placeholder={t("events.phoneNumberPlaceholder")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">{t("events.email")}</Label>
                <Input
                  type="email"
                  value={person.socialNetworkLink}
                  onChange={(e) => updatePerson(person.id, 'socialNetworkLink', e.target.value)}
                  placeholder={t("events.emailPlaceholder")}
                />
              </div>
              
              <div>
                <Label className="text-sm">{t("events.paymentAmount")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={person.paymentAmount}
                  onChange={(e) => updatePerson(person.id, 'paymentAmount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">{t("events.paymentStatus")}</Label>
                <Select
                  value={person.paymentStatus}
                  onValueChange={(value) => updatePerson(person.id, 'paymentStatus', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("events.selectPaymentStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
                    <SelectItem value="partly_paid">{t("events.partlyPaid")}</SelectItem>
                    <SelectItem value="fully_paid">{t("events.fullyPaid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm">{t("events.eventNotes")}</Label>
              <Textarea
                value={person.eventNotes}
                onChange={(e) => updatePerson(person.id, 'eventNotes', e.target.value)}
                placeholder={t("events.eventNotesPlaceholder")}
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
