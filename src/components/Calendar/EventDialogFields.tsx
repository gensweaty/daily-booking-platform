
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { cn } from "@/lib/utils";
import { CalendarEventType } from "@/lib/types/calendar";
import { FileRecord } from "@/types/files";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Bell, Mail } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TaskDateTimePicker } from "@/components/tasks/TaskDateTimePicker";

interface EventDialogFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  userSurname: string;
  setUserSurname: (userSurname: string) => void;
  userNumber: string;
  setUserNumber: (userNumber: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (socialNetworkLink: string) => void;
  eventNotes: string;
  setEventNotes: (eventNotes: string) => void;
  eventName: string;
  setEventName: (eventName: string) => void;
  startDate: string;
  setStartDate: (startDate: string) => void;
  endDate: string;
  setEndDate: (endDate: string) => void;
  paymentStatus: string;
  setPaymentStatus: (paymentStatus: string) => void;
  paymentAmount: string;
  setPaymentAmount: (paymentAmount: string) => void;
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
  eventId?: string;
  isRecurring: boolean;
  setIsRecurring: (isRecurring: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (repeatPattern: string) => void;
  repeatUntil: string;
  setRepeatUntil: (repeatUntil: string) => void;
  isNewEvent: boolean;
  additionalPersons: any[];
  setAdditionalPersons: (additionalPersons: any[]) => void;
  reminderAt: string;
  setReminderAt: (reminderAt: string) => void;
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (emailReminderEnabled: boolean) => void;
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
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  files,
  setFiles,
  existingFiles,
  setExistingFiles,
  eventId,
  isRecurring,
  setIsRecurring,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  isNewEvent,
  additionalPersons,
  setAdditionalPersons,
  reminderAt,
  setReminderAt,
  emailReminderEnabled,
  setEmailReminderEnabled,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  const paymentStatuses = [
    { value: 'not_paid', label: t('crm.notPaid') },
    { value: 'partly', label: t('crm.paidPartly') },
    { value: 'fully', label: t('crm.paidFully') },
  ];

  const repeatPatterns = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event-name">
            {isGeorgian ? <GeorgianAuthText>მოვლენის სახელი</GeorgianAuthText> : <LanguageText>{t("events.eventName")}</LanguageText>}
          </Label>
          <Input
            id="event-name"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">
            {isGeorgian ? <GeorgianAuthText>სათაური</GeorgianAuthText> : <LanguageText>{t("calendar.eventTitle")}</LanguageText>}
          </Label>
          <Input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="user-surname">
            {isGeorgian ? <GeorgianAuthText>სახელი გვარი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
          </Label>
          <Input
            type="text"
            id="user-surname"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-number">
            {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>{t("events.phoneNumber")}</LanguageText>}
          </Label>
          <Input
            type="text"
            id="user-number"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="social-network-link">
          {isGeorgian ? <GeorgianAuthText>ელ-ფოსტა</GeorgianAuthText> : <LanguageText>{t("events.socialLinkEmail")}</LanguageText>}
        </Label>
        <Input
          type="text"
          id="social-network-link"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="event-notes">
          {isGeorgian ? <GeorgianAuthText>ღონისძიების შენიშვნები</GeorgianAuthText> : <LanguageText>{t("events.eventNotes")}</LanguageText>}
        </Label>
        <Textarea
          id="event-notes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder={isGeorgian ? "დაამატეთ შენიშვნები თქვენი ჯავშნის შესახებ" : t("events.addEventNotes")}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-date">
            {isGeorgian ? <GeorgianAuthText>ᲓᲐᲡᲐᲬᲧᲘᲡᲘ</GeorgianAuthText> : <LanguageText>{t("events.start")}</LanguageText>}
          </Label>
          <Input
            type="datetime-local"
            id="start-date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end-date">
            {isGeorgian ? <GeorgianAuthText>ᲓᲐᲡᲐᲡᲠᲣᲚᲘ</GeorgianAuthText> : <LanguageText>{t("events.end")}</LanguageText>}
          </Label>
          <Input
            type="datetime-local"
            id="end-date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="payment-status">
            {isGeorgian ? <GeorgianAuthText>ᲒᲐᲓᲐᲮᲓᲘᲡ ᲡᲢᲐᲢᲣᲡᲘ</GeorgianAuthText> : <LanguageText>{t("events.paymentStatus")}</LanguageText>}
          </Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isGeorgian ? "აირჩიეთ გადახდის სტატუსი" : t("events.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent>
              {paymentStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {isGeorgian ? <GeorgianAuthText>{status.label}</GeorgianAuthText> : <LanguageText>{status.label}</LanguageText>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-amount">
            {isGeorgian ? <GeorgianAuthText>Გადახდის თანხა</GeorgianAuthText> : <LanguageText>{t("events.paymentAmount")}</LanguageText>}
          </Label>
          <Input
            type="number"
            id="payment-amount"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <FileUploadField onFilesChange={setFiles} />
      </div>

      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <Label>{isGeorgian ? <GeorgianAuthText>არსებული ფაილები</GeorgianAuthText> : <LanguageText>Existing Files</LanguageText>}</Label>
          <div className="flex flex-wrap gap-2">
            {existingFiles.map((file) => (
              <FileDisplay
                key={file.id}
                fileName={file.filename}
                filePath={file.file_path}
                onDelete={async () => {
                  setExistingFiles(existingFiles.filter((f) => f.id !== file.id));
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Event Reminder Section */}
      <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-blue-50/50">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          <Label className="text-sm font-medium text-blue-900">
            {isGeorgian ? <GeorgianAuthText>{t("events.eventReminder")}</GeorgianAuthText> : <LanguageText>{t("events.eventReminder")}</LanguageText>}
          </Label>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="email-reminder"
              checked={emailReminderEnabled}
              onCheckedChange={(checked) => setEmailReminderEnabled(!!checked)}
            />
            <Label htmlFor="email-reminder" className="text-sm cursor-pointer flex items-center gap-2">
              <Mail className="h-3 w-3" />
              {isGeorgian ? <GeorgianAuthText>{t("events.emailReminder")}</GeorgianAuthText> : <LanguageText>{t("events.emailReminder")}</LanguageText>}
            </Label>
          </div>
          
          {emailReminderEnabled && (
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">
                {isGeorgian ? <GeorgianAuthText>{t("events.selectReminderTime")}</GeorgianAuthText> : <LanguageText>{t("events.selectReminderTime")}</LanguageText>}
              </Label>
              <TaskDateTimePicker
                label={t("events.reminder")}
                value={reminderAt}
                onChange={setReminderAt}
                placeholder={t("events.selectReminderDate")}
                type="reminder"
                deadlineValue={startDate}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <Label>
          {isGeorgian ? <GeorgianAuthText>ᲛᲝᲕᲚᲔᲜᲐ ᲒᲐᲜᲛᲔᲝᲠᲓᲔᲑᲐ?</GeorgianAuthText> : <LanguageText>Is Recurring?</LanguageText>}
        </Label>
        <Checkbox
          checked={isRecurring}
          onCheckedChange={(checked) => setIsRecurring(!!checked)}
        />
      </div>

      {isRecurring && (
        <>
          <div className="space-y-2">
            <Label htmlFor="repeat-pattern">
              {isGeorgian ? <GeorgianAuthText>ᲒᲐᲜᲛᲔᲝᲠᲔᲑᲘᲡ ᲡᲮᲔᲛᲐ</GeorgianAuthText> : <LanguageText>Repeat Pattern</LanguageText>}
            </Label>
            <Select value={repeatPattern} onValueChange={setRepeatPattern}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={isGeorgian ? "აირჩიეთ განმეორების სქემა" : "Select Repeat Pattern"} />
              </SelectTrigger>
              <SelectContent>
                {repeatPatterns.map((pattern) => (
                  <SelectItem key={pattern.value} value={pattern.value}>
                    {pattern.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repeat-until">
              {isGeorgian ? <GeorgianAuthText>ᲒᲐᲜᲛᲔᲝᲠᲓᲔᲑᲐ ᲐᲛ ᲗᲐᲠᲘᲦᲐᲛᲓᲔ</GeorgianAuthText> : <LanguageText>Repeat Until</LanguageText>}
            </Label>
            <Input
              type="date"
              id="repeat-until"
              value={repeatUntil}
              onChange={(e) => setRepeatUntil(e.target.value)}
            />
          </div>
        </>
      )}
    </>
  );
};
