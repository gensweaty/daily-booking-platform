
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCurrencySymbol } from "@/lib/currency";

interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

interface ExistingFile {
  id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
}

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
  repeatUntil: Date | undefined;
  setRepeatUntil: (date: Date | undefined) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  existingFiles: ExistingFile[];
  onRemoveExistingFile: (fileId: string) => void;
  isNewEvent: boolean;
  additionalPersons: PersonData[];
  setAdditionalPersons: (persons: PersonData[]) => void;
  dataLoading: boolean;
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
  onRemoveExistingFile,
  isNewEvent,
  additionalPersons,
  setAdditionalPersons,
  dataLoading,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);

  // Enhanced logging for debugging recurring events
  console.log("🔄 EventDialogFields - Current recurring state:", {
    isRecurring,
    repeatPattern,
    repeatUntil: repeatUntil ? format(repeatUntil, 'yyyy-MM-dd') : null,
    isGeorgian,
    language
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setFiles(newFiles);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const handleAdditionalPersonChange = (index: number, field: string, value: string) => {
    const updatedPersons = [...additionalPersons];
    updatedPersons[index] = { ...updatedPersons[index], [field]: value };
    setAdditionalPersons(updatedPersons);
  };

  const handleAddPerson = () => {
    setAdditionalPersons([
      ...additionalPersons,
      {
        id: Date.now().toString(),
        userSurname: "",
        userNumber: "",
        socialNetworkLink: "",
        eventNotes: "",
        paymentStatus: "not_paid",
        paymentAmount: ""
      }
    ]);
  };

  const handleRemovePerson = (id: string) => {
    setAdditionalPersons(additionalPersons.filter(person => person.id !== id));
  };

  // Fixed repeat pattern change handler with proper mapping
  const handleRepeatPatternChange = (value: string) => {
    console.log("🔄 Repeat pattern changing from", repeatPattern, "to", value);
    setRepeatPattern(value);
    
    // Auto-set isRecurring based on pattern
    if (value && value !== 'none') {
      if (!isRecurring) {
        console.log("🔄 Auto-setting isRecurring to true");
        setIsRecurring(true);
      }
    } else {
      if (isRecurring) {
        console.log("🔄 Auto-setting isRecurring to false");
        setIsRecurring(false);
      }
    }
  };

  // Convert ExistingFile to FileRecord format
  const convertedExistingFiles = existingFiles.map(file => ({
    id: file.id,
    filename: file.filename,
    file_path: file.file_path,
    content_type: file.content_type || null,
    size: file.size || null,
    created_at: new Date().toISOString(), // Add missing field with current timestamp
    user_id: null, // Add missing field as nullable
    event_id: null,
    customer_id: null,
    source: 'event',
    parentType: 'event'
  }));

  return (
    <div className="space-y-4">
      {/* Title and Customer Info */}
      <div className="space-y-2">
        <Label htmlFor="title">{t("events.title")}</Label>
        <Input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("events.titlePlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userSurname">{t("events.customerName")}</Label>
        <Input
          type="text"
          id="userSurname"
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
          placeholder={t("events.customerNamePlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userNumber">{t("events.customerNumber")}</Label>
        <Input
          type="tel"
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          placeholder={t("events.customerNumberPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="socialNetworkLink">{t("events.customerSocial")}</Label>
        <Input
          type="text"
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder={t("events.customerSocialPlaceholder")}
        />
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">{t("events.startDate")}</Label>
          <Input
            type="datetime-local"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">{t("events.endDate")}</Label>
          <Input
            type="datetime-local"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Recurring Event Section */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="recurring"
            checked={isRecurring}
            onCheckedChange={(checked) => {
              console.log("🔄 Recurring checkbox changed to:", checked);
              setIsRecurring(checked as boolean);
              if (!checked) {
                console.log("🔄 Clearing repeat pattern");
                setRepeatPattern("none");
                setRepeatUntil(undefined);
              }
            }}
          />
          <Label htmlFor="recurring" className="text-sm font-medium">
            {isGeorgian ? "განმეორებადი ღონისძიება" : "Recurring Event"}
          </Label>
        </div>

        {isRecurring && (
          <div className="space-y-4 ml-6">
            <div className="space-y-2">
              <Label>{isGeorgian ? "განმეორების სიხშირე" : "Repeat Pattern"}</Label>
              <Select value={repeatPattern} onValueChange={handleRepeatPatternChange}>
                <SelectTrigger>
                  <SelectValue placeholder={isGeorgian ? "აირჩიეთ სიხშირე" : "Select repeat pattern"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isGeorgian ? "არ განმეორდეს" : "Do not repeat"}</SelectItem>
                  <SelectItem value="daily">{isGeorgian ? "ყოველდღიურად" : "Daily"}</SelectItem>
                  <SelectItem value="weekly">{isGeorgian ? "კვირაში ერთხელ" : "Weekly"}</SelectItem>
                  <SelectItem value="biweekly">{isGeorgian ? "ორ კვირაში ერთხელ" : "Every 2 weeks"}</SelectItem>
                  <SelectItem value="monthly">{isGeorgian ? "ყოველთვიურად" : "Monthly"}</SelectItem>
                  <SelectItem value="yearly">{isGeorgian ? "წლიურად" : "Yearly"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isGeorgian ? "განმეორების ბოლო თარიღი" : "Repeat Until"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !repeatUntil && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {repeatUntil ? format(repeatUntil, "PPP") : (isGeorgian ? "აირჩიეთ თარიღი" : "Pick a date")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={repeatUntil}
                    onSelect={(date) => {
                      console.log("🔄 Repeat until date selected:", date);
                      setRepeatUntil(date);
                    }}
                    disabled={(date) => date <= new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>

      {/* Payment Information */}
      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="paymentStatus">{t("events.paymentStatus")}</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("events.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
            <SelectItem value="partly">{t("events.paidPartly")}</SelectItem>
            <SelectItem value="fully">{t("events.paidFully")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paymentAmount">{t("events.paymentAmount")} ({currencySymbol})</Label>
        <Input
          type="number"
          id="paymentAmount"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
          placeholder={`${t("events.paymentAmount")} (${currencySymbol})`}
        />
      </div>

      {/* Event Notes */}
      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="eventNotes">{t("events.eventNotes")}</Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder={t("events.eventNotesPlaceholder")}
          className="min-h-[80px]"
        />
      </div>

      {/* Additional Persons */}
      <div className="space-y-2 border-t pt-4">
        <Label>{t("events.additionalPersons")}</Label>
        {additionalPersons.map((person, index) => (
          <div key={person.id} className="space-y-2 border rounded-md p-4">
            <div className="text-sm font-medium">{t("events.person")} {index + 1}</div>
            <Input
              type="text"
              placeholder={t("events.personName")}
              value={person.userSurname}
              onChange={(e) => handleAdditionalPersonChange(index, "userSurname", e.target.value)}
            />
            <Input
              type="tel"
              placeholder={t("events.personNumber")}
              value={person.userNumber}
              onChange={(e) => handleAdditionalPersonChange(index, "userNumber", e.target.value)}
            />
            <Input
              type="email"
              placeholder={t("events.personSocial")}
              value={person.socialNetworkLink}
              onChange={(e) => handleAdditionalPersonChange(index, "socialNetworkLink", e.target.value)}
            />
            <Textarea
              placeholder={t("events.personNotes")}
              value={person.eventNotes}
              onChange={(e) => handleAdditionalPersonChange(index, "eventNotes", e.target.value)}
              className="min-h-[60px]"
            />
            <div className="flex justify-end">
              <Button type="button" variant="destructive" size="sm" onClick={() => handleRemovePerson(person.id)}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t("events.removePerson")}
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={handleAddPerson}>
          <Plus className="h-4 w-4 mr-2" />
          {t("events.addPerson")}
        </Button>
      </div>

      {/* File Upload */}
      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="files">{t("events.attachments")}</Label>
        <Input type="file" id="files" multiple onChange={handleFileSelect} />
        {files.length > 0 && (
          <div className="mt-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                <span>{file.name}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveFile(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {existingFiles.length > 0 && (
          <div className="mt-2">
            <SimpleFileDisplay 
              files={convertedExistingFiles} 
              parentType="event"
              onFileDeleted={onRemoveExistingFile} 
            />
          </div>
        )}
      </div>
    </div>
  );
};
