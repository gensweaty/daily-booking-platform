import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadField } from "../shared/FileUploadField";
import { SimpleFileDisplay } from "../shared/SimpleFileDisplay";
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
  setTitle: (title: string) => void;
  userSurname: string;
  setUserSurname: (surname: string) => void;
  userNumber: string;
  setUserNumber: (number: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (link: string) => void;
  eventNotes: string;
  setEventNotes: (notes: string) => void;
  eventName: string;
  setEventName: (name: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  paymentStatus: string;
  setPaymentStatus: (status: string) => void;
  paymentAmount: string;
  setPaymentAmount: (amount: string) => void;
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
  setIsRecurring: (recurring: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (pattern: string) => void;
  repeatUntil: string;
  setRepeatUntil: (until: string) => void;
  isNewEvent: boolean;
  additionalPersons: PersonData[];
  setAdditionalPersons: (persons: PersonData[]) => void;
  reminderAt: string;
  setReminderAt: (reminder: string) => void;
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (enabled: boolean) => void;
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
  setEmailReminderEnabled,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const
  } : undefined;

  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and a single decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      setPaymentAmount(value);
    }
  };

  const handleAddPerson = () => {
    setAdditionalPersons(prevPersons => [
      ...prevPersons,
      {
        id: crypto.randomUUID(),
        userSurname: '',
        userNumber: '',
        socialNetworkLink: '',
        eventNotes: '',
        paymentStatus: 'not_paid',
        paymentAmount: ''
      }
    ]);
  };

  const handlePersonChange = (index: number, field: keyof PersonData, value: string) => {
    setAdditionalPersons(prevPersons => {
      const newPersons = [...prevPersons];
      newPersons[index] = { ...newPersons[index], [field]: value };
      return newPersons;
    });
  };

  const handleRemovePerson = (id: string) => {
    setAdditionalPersons(prevPersons => prevPersons.filter(person => person.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="userSurname" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>სახელი, გვარი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
          </Label>
          <Input
            type="text"
            id="userSurname"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
            placeholder={isGeorgian ? "სახელი, გვარი" : t("events.fullName")}
            required
          />
        </div>

        <div>
          <Label htmlFor="userNumber" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>{t("events.phoneNumber")}</LanguageText>}
          </Label>
          <Input
            type="tel"
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
            placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="socialNetworkLink" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>ელ. ფოსტა / Facebook</GeorgianAuthText> : <LanguageText>{t("events.emailOrFacebook")}</LanguageText>}
          </Label>
          <Input
            type="text"
            id="socialNetworkLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
            placeholder={isGeorgian ? "ელ. ფოსტა / Facebook" : t("events.emailOrFacebook")}
          />
        </div>

        <div>
          <Label htmlFor="eventNotes" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>შენიშვნები</GeorgianAuthText> : <LanguageText>{t("events.notes")}</LanguageText>}
          </Label>
          <Input
            type="text"
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
            placeholder={isGeorgian ? "შენიშვნები" : t("events.notes")}
          />
        </div>
      </div>

      {additionalPersons.length > 0 && (
        <div>
          <Label htmlFor="eventName" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>ღონისძიების სახელი</GeorgianAuthText> : <LanguageText>{t("events.eventName")}</LanguageText>}
          </Label>
          <Input
            type="text"
            id="eventName"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
            placeholder={isGeorgian ? "ღონისძიების სახელი" : t("events.eventName")}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>დაწყების დრო</GeorgianAuthText> : <LanguageText>{t("events.startTime")}</LanguageText>}
          </Label>
          <Input
            type="datetime-local"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
            required
          />
        </div>

        <div>
          <Label htmlFor="endDate" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>დასრულების დრო</GeorgianAuthText> : <LanguageText>{t("events.endTime")}</LanguageText>}
          </Label>
          <Input
            type="datetime-local"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paymentStatus" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText> : <LanguageText>{t("events.paymentStatus")}</LanguageText>}
          </Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              <SelectValue placeholder={isGeorgian ? "აირჩიეთ სტატუსი" : t("events.selectStatus")} />
            </SelectTrigger>
            <SelectContent className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              <SelectItem value="not_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>გადახდილი არაა</GeorgianAuthText> : <LanguageText>{t("events.notPaid")}</LanguageText>}
              </SelectItem>
              <SelectItem value="partly_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>ნაწილობრივ გადახდილია</GeorgianAuthText> : <LanguageText>{t("events.partlyPaid")}</LanguageText>}
              </SelectItem>
              <SelectItem value="fully_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>სრულად გადახდილია</GeorgianAuthText> : <LanguageText>{t("events.fullyPaid")}</LanguageText>}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentStatus === "partly_paid" || paymentStatus === "fully_paid" ? (
          <div>
            <Label htmlFor="paymentAmount" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>გადახდილი თანხა</GeorgianAuthText> : <LanguageText>{t("events.paymentAmount")}</LanguageText>}
            </Label>
            <Input
              type="text"
              id="paymentAmount"
              value={paymentAmount}
              onChange={handlePaymentAmountChange}
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
              placeholder={isGeorgian ? "გადახდილი თანხა" : t("events.paymentAmount")}
            />
          </div>
        ) : null}
      </div>

      {additionalPersons.length > 0 && (
        <div className="space-y-2">
          <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>დამატებითი პირები</GeorgianAuthText> : <LanguageText>{t("events.additionalPersons")}</LanguageText>}
          </Label>
          {additionalPersons.map((person, index) => (
            <div key={person.id} className="space-y-2 border p-4 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`userSurname-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>სახელი, გვარი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
                  </Label>
                  <Input
                    type="text"
                    id={`userSurname-${index}`}
                    value={person.userSurname}
                    onChange={(e) => handlePersonChange(index, 'userSurname', e.target.value)}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    style={georgianStyle}
                    placeholder={isGeorgian ? "სახელი, გვარი" : t("events.fullName")}
                  />
                </div>

                <div>
                  <Label htmlFor={`userNumber-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>{t("events.phoneNumber")}</LanguageText>}
                  </Label>
                  <Input
                    type="tel"
                    id={`userNumber-${index}`}
                    value={person.userNumber}
                    onChange={(e) => handlePersonChange(index, 'userNumber', e.target.value)}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    style={georgianStyle}
                    placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`socialNetworkLink-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>ელ. ფოსტა / Facebook</GeorgianAuthText> : <LanguageText>{t("events.emailOrFacebook")}</LanguageText>}
                  </Label>
                  <Input
                    type="text"
                    id={`socialNetworkLink-${index}`}
                    value={person.socialNetworkLink}
                    onChange={(e) => handlePersonChange(index, 'socialNetworkLink', e.target.value)}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    style={georgianStyle}
                    placeholder={isGeorgian ? "ელ. ფოსტა / Facebook" : t("events.emailOrFacebook")}
                  />
                </div>

                <div>
                  <Label htmlFor={`eventNotes-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>შენიშვნები</GeorgianAuthText> : <LanguageText>{t("events.notes")}</LanguageText>}
                  </Label>
                  <Input
                    type="text"
                    id={`eventNotes-${index}`}
                    value={person.eventNotes}
                    onChange={(e) => handlePersonChange(index, 'eventNotes', e.target.value)}
                    className={cn(isGeorgian ? "font-georgian" : "")}
                    style={georgianStyle}
                    placeholder={isGeorgian ? "შენიშვნები" : t("events.notes")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`paymentStatus-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText> : <LanguageText>{t("events.paymentStatus")}</LanguageText>}
                  </Label>
                  <Select value={person.paymentStatus} onValueChange={(value) => handlePersonChange(index, 'paymentStatus', value)}>
                    <SelectTrigger className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      <SelectValue placeholder={isGeorgian ? "აირჩიეთ სტატუსი" : t("events.selectStatus")} />
                    </SelectTrigger>
                    <SelectContent className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      <SelectItem value="not_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                        {isGeorgian ? <GeorgianAuthText>გადახდილი არაა</GeorgianAuthText> : <LanguageText>{t("events.notPaid")}</LanguageText>}
                      </SelectItem>
                      <SelectItem value="partly_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                        {isGeorgian ? <GeorgianAuthText>ნაწილობრივ გადახდილია</GeorgianAuthText> : <LanguageText>{t("events.partlyPaid")}</LanguageText>}
                      </SelectItem>
                      <SelectItem value="fully_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                        {isGeorgian ? <GeorgianAuthText>სრულად გადახდილია</GeorgianAuthText> : <LanguageText>{t("events.fullyPaid")}</LanguageText>}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(person.paymentStatus === "partly_paid" || person.paymentStatus === "fully_paid") && (
                  <div>
                    <Label htmlFor={`paymentAmount-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? <GeorgianAuthText>გადახდილი თანხა</GeorgianAuthText> : <LanguageText>{t("events.paymentAmount")}</LanguageText>}
                    </Label>
                    <Input
                      type="text"
                      id={`paymentAmount-${index}`}
                      value={person.paymentAmount}
                      onChange={(e) => handlePersonChange(index, 'paymentAmount', e.target.value)}
                      className={cn(isGeorgian ? "font-georgian" : "")}
                      style={georgianStyle}
                      placeholder={isGeorgian ? "გადახდილი თანხა" : t("events.paymentAmount")}
                    />
                  </div>
                )}
              </div>

              <Button variant="destructive" size="sm" onClick={() => handleRemovePerson(person.id)}>
                {isGeorgian ? <GeorgianAuthText>წაშლა</GeorgianAuthText> : <LanguageText>{t("common.delete")}</LanguageText>}
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={handleAddPerson}>
            {isGeorgian ? <GeorgianAuthText>დამატებითი პირის დამატება</GeorgianAuthText> : <LanguageText>{t("events.addAdditionalPerson")}</LanguageText>}
          </Button>
        </div>
      )}

      {isRecurring && (
        <div className="space-y-2">
          <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>გამეორების პარამეტრები</GeorgianAuthText> : <LanguageText>{t("events.recurringSettings")}</LanguageText>}
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="repeatPattern" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>გამეორების სიხშირე</GeorgianAuthText> : <LanguageText>{t("events.repeatFrequency")}</LanguageText>}
              </Label>
              <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                <SelectTrigger className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  <SelectValue placeholder={isGeorgian ? "აირჩიეთ სიხშირე" : t("events.selectFrequency")} />
                </SelectTrigger>
                <SelectContent className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  <SelectItem value="daily" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>ყოველდღიურად</GeorgianAuthText> : <LanguageText>{t("events.daily")}</LanguageText>}
                  </SelectItem>
                  <SelectItem value="weekly" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>ყოველკვირეულად</GeorgianAuthText> : <LanguageText>{t("events.weekly")}</LanguageText>}
                  </SelectItem>
                  <SelectItem value="monthly" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>ყოველთვიურად</GeorgianAuthText> : <LanguageText>{t("events.monthly")}</LanguageText>}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="repeatUntil" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>გამეორების დასრულება</GeorgianAuthText> : <LanguageText>{t("events.repeatUntil")}</LanguageText>}
              </Label>
              <Input
                type="date"
                id="repeatUntil"
                value={repeatUntil}
                onChange={(e) => setRepeatUntil(e.target.value)}
                className={cn(isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isRecurring"
          checked={isRecurring}
          onCheckedChange={setIsRecurring}
        />
        <Label htmlFor="isRecurring" className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed flex items-center", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          {isGeorgian ? <GeorgianAuthText>განმეორებადი</GeorgianAuthText> : <LanguageText>{t("events.isRecurring")}</LanguageText>}
        </Label>
      </div>
      
      {/* Add Reminder Field */}
      <div className="space-y-2">
        <ReminderField
          reminderAt={reminderAt}
          setReminderAt={setReminderAt}
          emailReminderEnabled={emailReminderEnabled}
          setEmailReminderEnabled={setEmailReminderEnabled}
          startDate={startDate}
        />
      </div>
    </div>
  );
};
