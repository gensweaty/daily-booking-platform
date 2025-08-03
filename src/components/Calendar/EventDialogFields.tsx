import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  setExistingFiles: React.Dispatch<React.SetStateAction<Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>>>;
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
  setAdditionalPersons: React.Dispatch<React.SetStateAction<PersonData[]>>;
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
  const shouldShowEventNameField = additionalPersons.length > 0;
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const
  } : undefined;

  const handleFileChange = (newFiles: File[]) => {
    setFiles(newFiles);
  };

  const handleFileDeleted = () => {
    // Refresh existing files after deletion
    if (eventId) {
      // Fetch existing files logic here
      // Example:
      // const fetchExistingFiles = async () => { ... };
      // fetchExistingFiles();
    }
  };

  const addPerson = () => {
    setAdditionalPersons([
      ...additionalPersons,
      {
        id: Math.random().toString(36).substring(7),
        userSurname: "",
        userNumber: "",
        socialNetworkLink: "",
        eventNotes: "",
        paymentStatus: "not_paid",
        paymentAmount: ""
      }
    ]);
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {/* Date & Time Section */}
      <div className="space-y-4">
        <h3 className={cn("text-lg font-semibold", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          {isGeorgian ? <GeorgianAuthText>თარიღი და დრო</GeorgianAuthText> : <LanguageText>{t("events.dateTime")}</LanguageText>}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>დაწყება</GeorgianAuthText> : <LanguageText>{t("events.start")}</LanguageText>}
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="endDate" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>დასრულება</GeorgianAuthText> : <LanguageText>{t("events.end")}</LanguageText>}
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
            <Label htmlFor="recurring" className={cn("flex items-center gap-2", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              🔄 {isGeorgian ? <GeorgianAuthText>გაამეორე ეს მოვლენა</GeorgianAuthText> : <LanguageText>{t("events.makeRecurring")}</LanguageText>}
            </Label>
          </div>

          <ReminderField
            reminderAt={reminderAt}
            setReminderAt={setReminderAt}
            emailReminderEnabled={emailReminderEnabled}
            setEmailReminderEnabled={setEmailReminderEnabled}
            startDate={startDate}
            className="flex-1"
          />
        </div>

        {/* Recurring event options */}
        {isRecurring && (
          <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
            <div className="space-y-2">
              <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>გამეორების ტიპი</GeorgianAuthText> : <LanguageText>{t("events.repeatPattern")}</LanguageText>}
              </Label>
              <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                <SelectTrigger>
                  <SelectValue placeholder={isGeorgian ? "აირჩიეთ ტიპი" : "Select pattern"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{isGeorgian ? "ყოველდღიურად" : "Daily"}</SelectItem>
                  <SelectItem value="weekly">{isGeorgian ? "კვირეულად" : "Weekly"}</SelectItem>
                  <SelectItem value="biweekly">{isGeorgian ? "ორ კვირაში ერთხელ" : "Biweekly"}</SelectItem>
                  <SelectItem value="monthly">{isGeorgian ? "ყოველთვიურად" : "Monthly"}</SelectItem>
                  <SelectItem value="yearly">{isGeorgian ? "წლიურად" : "Yearly"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>გამეორება მდე</GeorgianAuthText> : <LanguageText>{t("events.repeatUntil")}</LanguageText>}
              </Label>
              <Input
                type="date"
                value={repeatUntil}
                onChange={(e) => setRepeatUntil(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Person Data Section */}
      <div className="space-y-4">
        <h3 className={cn("text-lg font-semibold", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          {isGeorgian ? <GeorgianAuthText>პიროვნების მონაცემები</GeorgianAuthText> : <LanguageText>{t("events.personData")}</LanguageText>}
        </h3>
        
        {shouldShowEventNameField && (
          <div className="space-y-2">
            <Label htmlFor="eventName" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>მოვლენის სახელი</GeorgianAuthText> : <LanguageText>{t("events.eventName")}</LanguageText>}
            </Label>
            <Input
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder={isGeorgian ? "მოვლენის სახელი" : "Event Name"}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="userSurname" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>სრული სახელი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
          </Label>
          <Input
            id="userSurname"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
            placeholder={isGeorgian ? "სრული სახელი" : "Full Name"}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="userNumber" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>{t("events.phoneNumber")}</LanguageText>}
          </Label>
          <Input
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            placeholder={isGeorgian ? "ტელეფონის ნომერი" : "Phone Number"}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="socialNetworkLink" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>ელფოსტა</GeorgianAuthText> : <LanguageText>{t("events.email")}</LanguageText>}
          </Label>
          <Input
            id="socialNetworkLink"
            type="email"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            placeholder={isGeorgian ? "email@example.com" : "email@example.com"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText> : <LanguageText>{t("events.paymentStatus")}</LanguageText>}
            </Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_paid">{isGeorgian ? "არ არის გადახდილი" : "Not Paid"}</SelectItem>
                <SelectItem value="partly_paid">{isGeorgian ? "ნაწილობრივ გადახდილი" : "Partly Paid"}</SelectItem>
                <SelectItem value="fully_paid">{isGeorgian ? "სრულად გადახდილი" : "Fully Paid"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showPaymentAmount && (
            <div className="space-y-2">
              <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>თანხა</GeorgianAuthText> : <LanguageText>{t("events.amount")}</LanguageText>}
              </Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventNotes" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>მოვლენის შენიშვნები</GeorgianAuthText> : <LanguageText>{t("events.eventNotes")}</LanguageText>}
          </Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            placeholder={isGeorgian ? "დაამატეთ შენიშვნები თქვენს ჯავშნის მოთხოვნაზე" : "Add notes about your booking request"}
            className="min-h-[80px]"
          />
        </div>

        {/* Additional Persons */}
        {additionalPersons.length > 0 && (
          <div className="space-y-4">
            <h4 className={cn("font-medium", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>დამატებითი პირები</GeorgianAuthText> : <LanguageText>{t("events.additionalPersons")}</LanguageText>}
            </h4>
            {additionalPersons.map((person, index) => (
              <div key={person.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor={`userSurname-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>სრული სახელი</GeorgianAuthText> : <LanguageText>{t("events.fullName")}</LanguageText>}
                  </Label>
                  <Input
                    type="text"
                    id={`userSurname-${index}`}
                    value={person.userSurname}
                    onChange={(e) => {
                      const newPersons = [...additionalPersons];
                      newPersons[index] = { ...person, userSurname: e.target.value };
                      setAdditionalPersons(newPersons);
                    }}
                    placeholder={isGeorgian ? "სრული სახელი" : "Full Name"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`userNumber-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>{t("events.phoneNumber")}</LanguageText>}
                  </Label>
                  <Input
                    type="text"
                    id={`userNumber-${index}`}
                    value={person.userNumber}
                    onChange={(e) => {
                      const newPersons = [...additionalPersons];
                      newPersons[index] = { ...person, userNumber: e.target.value };
                      setAdditionalPersons(newPersons);
                    }}
                    placeholder={isGeorgian ? "ტელეფონის ნომერი" : "Phone Number"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`socialNetworkLink-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>ელფოსტა</GeorgianAuthText> : <LanguageText>{t("events.email")}</LanguageText>}
                  </Label>
                  <Input
                    type="email"
                    id={`socialNetworkLink-${index}`}
                    value={person.socialNetworkLink}
                    onChange={(e) => {
                      const newPersons = [...additionalPersons];
                      newPersons[index] = { ...person, socialNetworkLink: e.target.value };
                      setAdditionalPersons(newPersons);
                    }}
                    placeholder={isGeorgian ? "email@example.com" : "email@example.com"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`eventNotes-${index}`} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>შენიშვნები</GeorgianAuthText> : <LanguageText>{t("events.notes")}</LanguageText>}
                  </Label>
                  <Textarea
                    id={`eventNotes-${index}`}
                    value={person.eventNotes}
                    onChange={(e) => {
                      const newPersons = [...additionalPersons];
                      newPersons[index] = { ...person, eventNotes: e.target.value };
                      setAdditionalPersons(newPersons);
                    }}
                    placeholder={isGeorgian ? "შენიშვნები" : "Notes"}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText> : <LanguageText>{t("events.paymentStatus")}</LanguageText>}
                  </Label>
                  <Select
                    value={person.paymentStatus}
                    onValueChange={(value) => {
                      const newPersons = [...additionalPersons];
                      newPersons[index] = { ...person, paymentStatus: value };
                      setAdditionalPersons(newPersons);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_paid">{isGeorgian ? "არ არის გადახდილი" : "Not Paid"}</SelectItem>
                      <SelectItem value="partly_paid">{isGeorgian ? "ნაწილობრივ გადახდილი" : "Partly Paid"}</SelectItem>
                      <SelectItem value="fully_paid">{isGeorgian ? "სრულად გადახდილი" : "Fully Paid"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? <GeorgianAuthText>თანხა</GeorgianAuthText> : <LanguageText>{t("events.amount")}</LanguageText>}
                  </Label>
                  <Input
                    type="number"
                    value={person.paymentAmount}
                    onChange={(e) => {
                      const newPersons = [...additionalPersons];
                      newPersons[index] = { ...person, paymentAmount: e.target.value };
                      setAdditionalPersons(newPersons);
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addPerson}
          className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <span className="text-xl">+</span>
          <span className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? <GeorgianAuthText>პიროვნების დამატება</GeorgianAuthText> : <LanguageText>{t("events.addPerson")}</LanguageText>}
          </span>
        </button>
      </div>

      {/* Attachments Section */}
      <div className="space-y-4">
        <h3 className={cn("text-lg font-semibold", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
          {isGeorgian ? <GeorgianAuthText>დანართები</GeorgianAuthText> : <LanguageText>{t("events.attachments")}</LanguageText>}
        </h3>
        
        {existingFiles && existingFiles.length > 0 && (
          <SimpleFileDisplay 
            files={existingFiles} 
            parentType="event"
            allowDelete
            onFileDeleted={handleFileDeleted}
            parentId={eventId}
          />
        )}
        
        <FileUploadField 
          onChange={handleFileChange}
          fileError=""
          setFileError={() => {}}
          acceptedFileTypes=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls"
        />
      </div>
    </div>
  );
};
