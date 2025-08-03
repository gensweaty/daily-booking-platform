import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";
import { ReminderField } from "@/components/shared/ReminderField";

interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
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
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
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
  isBookingRequest?: boolean;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  repeatUntil: string;
  setRepeatUntil: (value: string) => void;
  isNewEvent: boolean;
  additionalPersons: PersonData[];
  setAdditionalPersons: (persons: PersonData[]) => void;
  reminderAt: string;
  setReminderAt: (value: string) => void;
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (value: boolean) => void;
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
  isBookingRequest = false,
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
  setEmailReminderEnabled
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const
  } : undefined;

  const handlePaymentStatusChange = (value: string) => {
    setPaymentStatus(value);
  };

  const handleAddPerson = () => {
    setAdditionalPersons([
      ...additionalPersons,
      {
        id: Math.random().toString(36).substring(7),
        userSurname: '',
        userNumber: '',
        socialNetworkLink: '',
        eventNotes: '',
        paymentStatus: 'not_paid',
        paymentAmount: ''
      }
    ]);
  };

  const handleRemovePerson = (id: string) => {
    setAdditionalPersons(additionalPersons.filter(person => person.id !== id));
  };

  const handlePersonChange = (id: string, field: string, value: string) => {
    setAdditionalPersons(
      additionalPersons.map(person =>
        person.id === id ? { ...person, [field]: value } : person
      )
    );
  };

  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";
  const shouldShowEventNameField = additionalPersons.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="title" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>სათაური</GeorgianAuthText> : <LanguageText>{t("events.title")}</LanguageText>}
          </Label>
          <Input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isBookingRequest}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="userSurname" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>სახელი, გვარი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
          </Label>
          <Input
            type="text"
            id="userSurname"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="userNumber" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>{t("events.phoneNumber")}</LanguageText>}
          </Label>
          <Input
            type="tel"
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="socialNetworkLink" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>ელ. ფოსტა</GeorgianAuthText> : <LanguageText>{t("events.email")}</LanguageText>}
          </Label>
          <Input
            type="email"
            id="socialNetworkLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="eventNotes" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>შენიშვნები</GeorgianAuthText> : <LanguageText>{t("events.notes")}</LanguageText>}
          </Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
          />
        </div>

        {shouldShowEventNameField && (
          <div className="grid gap-2">
            <Label htmlFor="eventName" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>მოვლენის სახელი</GeorgianAuthText> : <LanguageText>{t("events.eventName")}</LanguageText>}
            </Label>
            <Input
              type="text"
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="startDate" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>დაწყების დრო</GeorgianAuthText> : <LanguageText>{t("events.startTime")}</LanguageText>}
            </Label>
            <Input
              type="datetime-local"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="endDate" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>დასრულების დრო</GeorgianAuthText> : <LanguageText>{t("events.endTime")}</LanguageText>}
            </Label>
            <Input
              type="datetime-local"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="paymentStatus" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText> : <LanguageText>{t("events.paymentStatus")}</LanguageText>}
          </Label>
          <Select onValueChange={handlePaymentStatusChange} defaultValue={paymentStatus}>
            <SelectTrigger id="paymentStatus">
              <SelectValue placeholder={isGeorgian ? "აირჩიეთ სტატუსი" : t("events.selectStatus") || "Select status"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid" style={georgianStyle}>{isGeorgian ? <GeorgianAuthText>არ არის გადახდილი</GeorgianAuthText> : <LanguageText> {t("events.notPaid")}</LanguageText>}</SelectItem>
              <SelectItem value="partly_paid" style={georgianStyle}>{isGeorgian ? <GeorgianAuthText>ნაწილობრივ გადახდილი</GeorgianAuthText> : <LanguageText>{t("events.partlyPaid")}</LanguageText>}</SelectItem>
              <SelectItem value="fully_paid" style={georgianStyle}>{isGeorgian ? <GeorgianAuthText>სრულად გადახდილი</GeorgianAuthText> : <LanguageText>{t("events.fullyPaid")}</LanguageText>}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showPaymentAmount && (
          <div className="grid gap-2">
            <Label htmlFor="paymentAmount" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>გადახდის თანხა</GeorgianAuthText> : <LanguageText>{t("events.paymentAmount")}</LanguageText>}
            </Label>
            <Input
              type="number"
              id="paymentAmount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
          </div>
        )}
      </div>

      {additionalPersons.map((person, index) => (
        <div key={person.id} className="space-y-2 border p-4 rounded-md">
          <h4 className={cn("text-lg font-semibold", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>დამატებითი პირი {index + 1}</GeorgianAuthText> : <LanguageText>Additional Person {index + 1}</LanguageText>}
          </h4>
          <div className="grid gap-2">
            <Label htmlFor={`userSurname-${person.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>სახელი, გვარი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
            </Label>
            <Input
              type="text"
              id={`userSurname-${person.id}`}
              value={person.userSurname}
              onChange={(e) => handlePersonChange(person.id, 'userSurname', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`userNumber-${person.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>{t("events.phoneNumber")}</LanguageText>}
            </Label>
            <Input
              type="tel"
              id={`userNumber-${person.id}`}
              value={person.userNumber}
              onChange={(e) => handlePersonChange(person.id, 'userNumber', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`socialNetworkLink-${person.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>ელ. ფოსტა</GeorgianAuthText> : <LanguageText>{t("events.email")}</LanguageText>}
            </Label>
            <Input
              type="email"
              id={`socialNetworkLink-${person.id}`}
              value={person.socialNetworkLink}
              onChange={(e) => handlePersonChange(person.id, 'socialNetworkLink', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`eventNotes-${person.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>შენიშვნები</GeorgianAuthText> : <LanguageText>{t("events.notes")}</LanguageText>}
            </Label>
            <Textarea
              id={`eventNotes-${person.id}`}
              value={person.eventNotes}
              onChange={(e) => handlePersonChange(person.id, 'eventNotes', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`paymentStatus-${person.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText> : <LanguageText>{t("events.paymentStatus")}</LanguageText>}
            </Label>
            <Select onValueChange={(value) => handlePersonChange(person.id, 'paymentStatus', value)} defaultValue={person.paymentStatus}>
              <SelectTrigger id={`paymentStatus-${person.id}`}>
                <SelectValue placeholder={isGeorgian ? "აირჩიეთ სტატუსი" : t("events.selectStatus") || "Select status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_paid" style={georgianStyle}>{isGeorgian ? <GeorgianAuthText>არ არის გადახდილი</GeorgianAuthText> : <LanguageText> {t("events.notPaid")}</LanguageText>}</SelectItem>
                <SelectItem value="partly_paid" style={georgianStyle}>{isGeorgian ? <GeorgianAuthText>ნაწილობრივ გადახდილი</GeorgianAuthText> : <LanguageText>{t("events.partlyPaid")}</LanguageText>}</SelectItem>
                <SelectItem value="fully_paid" style={georgianStyle}>{isGeorgian ? <GeorgianAuthText>სრულად გადახდილი</GeorgianAuthText> : <LanguageText>{t("events.fullyPaid")}</LanguageText>}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {person.paymentStatus === "partly_paid" || person.paymentStatus === "fully_paid" ? (
            <div className="grid gap-2">
              <Label htmlFor={`paymentAmount-${person.id}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>გადახდის თანხა</GeorgianAuthText> : <LanguageText>{t("events.paymentAmount")}</LanguageText>}
              </Label>
              <Input
                type="number"
                id={`paymentAmount-${person.id}`}
                value={person.paymentAmount}
                onChange={(e) => handlePersonChange(person.id, 'paymentAmount', e.target.value)}
              />
            </div>
          ) : null}
          <Button variant="destructive" size="sm" onClick={() => handleRemovePerson(person.id)}>
            {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
          </Button>
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={handleAddPerson}>
        {isGeorgian ? <GeorgianAuthText>დამატებითი პირის დამატება</GeorgianAuthText> : <LanguageText>{t("events.addAdditionalPerson")}</LanguageText>}
      </Button>

      <div className="flex items-center space-x-2">
        <Switch id="isRecurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
        <Label htmlFor="isRecurring" className={cn("text-md font-medium leading-none peer-disabled:cursor-not-allowed", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          {isGeorgian ? <GeorgianAuthText>განმეორებადი</GeorgianAuthText> : <LanguageText>{t("events.recurringEvent")}</LanguageText>}
        </Label>
      </div>

      {isRecurring && (
        <div className="space-y-2">
          <div className="grid gap-2">
            <Label htmlFor="repeatPattern" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>გამეორების სიხშირე</GeorgianAuthText> : <LanguageText>{t("events.repeatPattern")}</LanguageText>}
            </Label>
            <Select onValueChange={setRepeatPattern} defaultValue={repeatPattern}>
              <SelectTrigger id="repeatPattern">
                <SelectValue placeholder={isGeorgian ? "აირჩიეთ სიხშირე" : t("events.selectFrequency") || "Select frequency"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily" style={georgianStyle}>{isGeorgian ? <GeorgianAuthText>ყოველდღიურად</GeorgianAuthText> : <LanguageText>{t("events.daily")}</LanguageText>}</SelectItem>
                <SelectItem value="weekly" style={georgianStyle}>{isGeorgian ? <GeorgianAuthText>ყოველკვირეულად</GeorgianAuthText> : <LanguageText>{t("events.weekly")}</LanguageText>}</SelectItem>
                <SelectItem value="monthly" style={georgianStyle}>{isGeorgian ? <GeorgianAuthText>ყოველთვიურად</GeorgianAuthText> : <LanguageText>{t("events.monthly")}</LanguageText>}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="repeatUntil" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>გამეორების დასრულება</GeorgianAuthText> : <LanguageText>{t("events.repeatUntil")}</LanguageText>}
            </Label>
            <Input
              type="date"
              id="repeatUntil"
              value={repeatUntil}
              onChange={(e) => setRepeatUntil(e.target.value)}
            />
          </div>
        </div>
      )}

      <ReminderField
        reminderAt={reminderAt}
        setReminderAt={setReminderAt}
        emailReminderEnabled={emailReminderEnabled}
        setEmailReminderEnabled={setEmailReminderEnabled}
        startDate={startDate}
        className="space-y-2"
      />

      {eventId && existingFiles && existingFiles.length > 0 && (
        <div className="space-y-2">
          <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>მიმაგრებული ფაილები</GeorgianAuthText> : <LanguageText>{t("common.attachedFiles")}</LanguageText>}
          </Label>
          <SimpleFileDisplay
            files={existingFiles}
            parentType="event"
            allowDelete
            parentId={eventId}
            setExistingFiles={setExistingFiles}
          />
        </div>
      )}

      <FileUploadField
        onChange={setFiles}
        acceptedFileTypes=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt"
      />
    </div>
  );
};
