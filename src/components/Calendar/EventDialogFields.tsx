import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";
import { EmailReminderSection } from "./EmailReminderSection";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { Plus, Trash2 } from "lucide-react";

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
  isBookingRequest: boolean;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  repeatUntil: string;
  setRepeatUntil: (value: string) => void;
  isNewEvent: boolean;
  additionalPersons: PersonData[];
  setAdditionalPersons: (persons: PersonData[]) => void;
  isVirtualEvent: boolean;
  // Email reminder props
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (enabled: boolean) => void;
  reminderAt?: string;
  setReminderAt: (time: string | undefined) => void;
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
  isBookingRequest,
  isRecurring,
  setIsRecurring,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  isNewEvent,
  additionalPersons,
  setAdditionalPersons,
  isVirtualEvent,
  emailReminderEnabled,
  setEmailReminderEnabled,
  reminderAt,
  setReminderAt
}: EventDialogFieldsProps) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

  // All helper functions and handlers

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-4">
        {/* Basic Fields */}
        <div className="space-y-2">
          <Label htmlFor="userSurname" className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>სახელი/გვარი *</GeorgianAuthText> : <LanguageText>Name/Surname *</LanguageText>}
          </Label>
          <Input
            id="userSurname"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
            placeholder={isGeorgian ? "შეიყვანეთ სახელი/გვარი" : "Enter name/surname"}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="userNumber" className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText> : <LanguageText>Phone Number</LanguageText>}
          </Label>
          <Input
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            placeholder={isGeorgian ? "შეიყვანეთ ტელეფონის ნომერი" : "Enter phone number"}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="socialNetworkLink" className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>ელ. ფოსტა</GeorgianAuthText> : <LanguageText>Email</LanguageText>}
          </Label>
          <Input
            id="socialNetworkLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            placeholder={isGeorgian ? "შეიყვანეთ ელ. ფოსტა" : "Enter email"}
            type="email"
          />
        </div>

        {/* Email Reminder Section */}
        <EmailReminderSection
          emailReminderEnabled={emailReminderEnabled}
          setEmailReminderEnabled={setEmailReminderEnabled}
          reminderAt={reminderAt}
          setReminderAt={setReminderAt}
          isNewEvent={isNewEvent}
        />
      </div>

      {/* Right Column */}
      <div className="space-y-4">
        {/* Date/Time Fields */}
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>დაწყების დრო *</GeorgianAuthText> : <LanguageText>Start Time *</LanguageText>}
          </Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>დასრულების დრო *</GeorgianAuthText> : <LanguageText>End Time *</LanguageText>}
          </Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        {/* Payment Fields */}
        <div className="space-y-2">
          <Label htmlFor="paymentStatus" className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText> : <LanguageText>Payment Status</LanguageText>}
          </Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">
                {isGeorgian ? <GeorgianAuthText>არ არის გადახდილი</GeorgianAuthText> : <LanguageText>Not Paid</LanguageText>}
              </SelectItem>
              <SelectItem value="partly_paid">
                {isGeorgian ? <GeorgianAuthText>ნაწილობრივ გადახდილი</GeorgianAuthText> : <LanguageText>Partly Paid</LanguageText>}
              </SelectItem>
              <SelectItem value="fully_paid">
                {isGeorgian ? <GeorgianAuthText>სრულად გადახდილი</GeorgianAuthText> : <LanguageText>Fully Paid</LanguageText>}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentAmount" className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>გადახდის თანხა</GeorgianAuthText> : <LanguageText>Payment Amount</LanguageText>}
          </Label>
          <Input
            id="paymentAmount"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder={isGeorgian ? "შეიყვანეთ თანხა" : "Enter amount"}
            min="0"
            step="0.01"
          />
        </div>
      </div>

      {/* Full Width Fields */}
      <div className="md:col-span-2 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="eventNotes" className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>შენიშვნები</GeorgianAuthText> : <LanguageText>Notes</LanguageText>}
          </Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            placeholder={isGeorgian ? "დამატებითი ინფორმაცია..." : "Additional information..."}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventName" className="text-sm font-medium">
            {isGeorgian ? <GeorgianAuthText>მოვლენის სახელი</GeorgianAuthText> : <LanguageText>Event Name</LanguageText>}
          </Label>
          <Input
            id="eventName"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder={isGeorgian ? "შეიყვანეთ მოვლენის სახელი" : "Enter event name"}
          />
        </div>

        {/* Recurring Event Fields */}
        {isNewEvent && !isVirtualEvent && !isBookingRequest && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
              <Label htmlFor="recurring" className="text-sm font-medium">
                {isGeorgian ? <GeorgianAuthText>განმეორებადი მოვლენა</GeorgianAuthText> : <LanguageText>Recurring Event</LanguageText>}
              </Label>
            </div>

            {isRecurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="repeatPattern" className="text-sm font-medium">
                    {isGeorgian ? <GeorgianAuthText>განმეორების ტიპი</GeorgianAuthText> : <LanguageText>Repeat Pattern</LanguageText>}
                  </Label>
                  <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                    <SelectTrigger>
                      <SelectValue placeholder={isGeorgian ? "აირჩიეთ ტიპი" : "Select pattern"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">
                        {isGeorgian ? <GeorgianAuthText>ყოველდღიურად</GeorgianAuthText> : <LanguageText>Daily</LanguageText>}
                      </SelectItem>
                      <SelectItem value="weekly">
                        {isGeorgian ? <GeorgianAuthText>ყოველკვირეულად</GeorgianAuthText> : <LanguageText>Weekly</LanguageText>}
                      </SelectItem>
                      <SelectItem value="biweekly">
                        {isGeorgian ? <GeorgianAuthText>ორ კვირაში ერთხელ</GeorgianAuthText> : <LanguageText>Bi-weekly</LanguageText>}
                      </SelectItem>
                      <SelectItem value="monthly">
                        {isGeorgian ? <GeorgianAuthText>ყოველთვიურად</GeorgianAuthText> : <LanguageText>Monthly</LanguageText>}
                      </SelectItem>
                      <SelectItem value="yearly">
                        {isGeorgian ? <GeorgianAuthText>ყოველწლიურად</GeorgianAuthText> : <LanguageText>Yearly</LanguageText>}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repeatUntil" className="text-sm font-medium">
                    {isGeorgian ? <GeorgianAuthText>განმეორება მდე</GeorgianAuthText> : <LanguageText>Repeat Until</LanguageText>}
                  </Label>
                  <Input
                    id="repeatUntil"
                    type="date"
                    value={repeatUntil}
                    onChange={(e) => setRepeatUntil(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* File Upload */}
        {eventId && (
          <div className="space-y-4 border-t pt-4">
            <Label className="text-sm font-medium">
              {isGeorgian ? <GeorgianAuthText>ფაილები</GeorgianAuthText> : <LanguageText>Files</LanguageText>}
            </Label>
            
            <FileUploadField
              files={files}
              onFilesChange={setFiles}
              bucketName="event_attachments"
              multiple={true}
            />

            {existingFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  {isGeorgian ? <GeorgianAuthText>არსებული ფაილები</GeorgianAuthText> : <LanguageText>Existing Files</LanguageText>}
                </Label>
                <SimpleFileDisplay
                  files={existingFiles}
                  onFileDelete={(fileId) => {
                    setExistingFiles(existingFiles.filter(f => f.id !== fileId));
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
