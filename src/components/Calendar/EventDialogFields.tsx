
import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdditionalPersonsSection } from "./AdditionalPersonsSection";

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
  additionalPersons,
  setAdditionalPersons,
  isNewEvent,
}: EventDialogFieldsProps) => {
  const { t } = useLanguage();

  console.log("EventDialogFields render - isRecurring:", isRecurring, "isNewEvent:", isNewEvent);

  const handleRecurringChange = (checked: boolean | string) => {
    console.log("Recurring checkbox changed:", checked, typeof checked);
    try {
      const isChecked = checked === true || checked === "true";
      setIsRecurring(isChecked);
      
      // Reset recurring fields when unchecking
      if (!isChecked) {
        setRepeatPattern("");
        setRepeatUntil("");
      }
    } catch (error) {
      console.error("Error in handleRecurringChange:", error);
    }
  };

  const handleRepeatPatternChange = (value: string) => {
    console.log("Repeat pattern changed:", value);
    try {
      setRepeatPattern(value);
    } catch (error) {
      console.error("Error in handleRepeatPatternChange:", error);
    }
  };

  const handleRepeatUntilChange = (value: string) => {
    console.log("Repeat until changed:", value);
    try {
      setRepeatUntil(value);
    } catch (error) {
      console.error("Error in handleRepeatUntilChange:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">{t("events.start")}</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">{t("events.end")}</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        {isNewEvent && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRecurring"
                checked={isRecurring}
                onCheckedChange={handleRecurringChange}
              />
              <Label htmlFor="isRecurring" className="text-sm font-medium">
                🔄 {t("events.makeRecurring")}
              </Label>
            </div>

            {isRecurring && (
              <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="repeatPattern">{t("events.repeatPattern")}</Label>
                  <Select value={repeatPattern} onValueChange={handleRepeatPatternChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("events.selectPattern")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t("events.daily")}</SelectItem>
                      <SelectItem value="weekly">{t("events.weekly")}</SelectItem>
                      <SelectItem value="monthly">{t("events.monthly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repeatUntil">{t("events.repeatUntil")}</Label>
                  <Input
                    id="repeatUntil"
                    type="date"
                    value={repeatUntil}
                    onChange={(e) => handleRepeatUntilChange(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">{t("events.title")}</Label>
        <Input
          id="title"
          placeholder={t("events.titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userSurname">{t("events.fullName")}</Label>
        <Input
          id="userSurname"
          placeholder={t("events.fullNamePlaceholder")}
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userNumber">{t("events.phoneNumber")}</Label>
        <Input
          id="userNumber"
          type="tel"
          placeholder={t("events.phoneNumberPlaceholder")}
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="socialNetworkLink">{t("events.email")}</Label>
        <Input
          id="socialNetworkLink"
          type="email"
          placeholder={t("events.emailPlaceholder")}
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventName">{t("events.eventName")}</Label>
        <Input
          id="eventName"
          placeholder={t("events.eventNamePlaceholder")}
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventNotes">{t("events.notes")}</Label>
        <Textarea
          id="eventNotes"
          placeholder={t("events.notesPlaceholder")}
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </div>

      <div className="space-y-2">
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

      {(paymentStatus === "partly_paid" || paymentStatus === "fully_paid") && (
        <div className="space-y-2">
          <Label htmlFor="paymentAmount">{t("events.paymentAmount")}</Label>
          <Input
            id="paymentAmount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
        </div>
      )}

      <AdditionalPersonsSection
        additionalPersons={additionalPersons}
        setAdditionalPersons={setAdditionalPersons}
      />

      <FileUploadField 
        onChange={(file) => {
          if (file) {
            setFiles([...files, file]);
          }
        }}
        fileError=""
        setFileError={() => {}}
      />
    </div>
  );
};
