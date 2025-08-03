import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarEventType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
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
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
  setExistingFiles: (
    existingFiles: Array<{
      id: string;
      event_id: string;
      filename: string;
      file_path: string;
      content_type?: string;
      size?: number;
    }>
  ) => void;
  eventId?: string;
  isBookingRequest?: boolean;
  isRecurring: boolean;
  setIsRecurring: (isRecurring: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (repeatPattern: string) => void;
  repeatUntil: string;
  setRepeatUntil: (repeatUntil: string) => void;
  isNewEvent: boolean;
  additionalPersons: any[];
  setAdditionalPersons: (additionalPersons: any[]) => void;
  reminderTime: Date | null;
  setReminderTime: (reminderTime: Date | null) => void;
  reminderEnabled: boolean;
  setReminderEnabled: (reminderEnabled: boolean) => void;
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
  isNewEvent = false,
  additionalPersons,
  setAdditionalPersons,
  reminderTime,
  setReminderTime,
  reminderEnabled,
  setReminderEnabled,
}: EventDialogFieldsProps) => {
  const { t } = useLanguage();

  const handleReminderTimeChange = (time: string | undefined) => {
    if (time) {
      setReminderTime(new Date(time));
    } else {
      setReminderTime(null);
    }
  };

  const formatReminderTimeForPicker = (time: Date | null): string => {
    if (!time) return "";
    return time.toISOString();
  };

  return (
    <div className="space-y-6">
      
      <div className="space-y-2">
        <Label htmlFor="title">{t("events.fullName")}</Label>
        <Input
          id="title"
          placeholder={t("events.fullName")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userSurname">{t("settings.businessName")}</Label>
        <Input
          id="userSurname"
          placeholder={t("settings.businessName")}
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userNumber">{t("events.phoneNumber")}</Label>
        <Input
          id="userNumber"
          placeholder={t("events.phoneNumber")}
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="socialNetworkLink">{t("events.socialLinkEmail")}</Label>
        <Input
          id="socialNetworkLink"
          placeholder={t("events.socialLinkEmail")}
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventNotes">{t("events.eventNotes")}</Label>
        <Input
          id="eventNotes"
          placeholder={t("events.addEventNotes")}
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventName">{t("settings.description")}</Label>
        <Input
          id="eventName"
          placeholder={t("settings.description")}
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">{t("events.dateAndTime")}</Label>
        <Input
          id="startDate"
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate">{t("calendar.end")}</Label>
        <Input
          id="endDate"
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="paymentStatus">{t("events.paymentStatus")}</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("events.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
            <SelectItem value="partly_paid">{t("crm.paidPartly")}</SelectItem>
            <SelectItem value="fully_paid">{t("crm.paidFully")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paymentAmount">{t("events.paymentAmount")}</Label>
        <Input
          id="paymentAmount"
          placeholder={t("events.paymentAmount")}
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
        />
      </div>

      {!isBookingRequest && (
        <div className="flex items-center justify-between space-x-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="recurring"
              checked={isRecurring}
              onCheckedChange={(checked) => {
                setIsRecurring(!!checked);
                if (!checked) {
                  setRepeatPattern("");
                  setRepeatUntil("");
                }
              }}
            />
            <Label htmlFor="recurring">Make this event recurring</Label>
          </div>
          
          {socialNetworkLink && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reminder"
                checked={reminderEnabled}
                onCheckedChange={(checked) => {
                  setReminderEnabled(!!checked);
                  if (!checked) {
                    setReminderTime(null);
                  }
                }}
                className="ml-4"
              />
              <Label htmlFor="reminder">{t("events.setReminder")}</Label>
            </div>
          )}
        </div>
      )}

      {isRecurring && (
        <>
          <div className="space-y-2">
            <Label htmlFor="repeatPattern">Repeat Pattern</Label>
            <Input
              id="repeatPattern"
              placeholder="e.g., weekly, monthly"
              value={repeatPattern}
              onChange={(e) => setRepeatPattern(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repeatUntil">Repeat Until</Label>
            <Input
              id="repeatUntil"
              type="date"
              value={repeatUntil}
              onChange={(e) => setRepeatUntil(e.target.value)}
            />
          </div>
        </>
      )}

      {reminderEnabled && (
        <div className="space-y-2">
          <Label htmlFor="reminderTime">Reminder Time</Label>
          <TaskDateTimePicker
            label="Reminder Time"
            value={formatReminderTimeForPicker(reminderTime)}
            onChange={handleReminderTimeChange}
            placeholder="Set reminder time"
            type="reminder"
            emailReminder={false}
            onEmailReminderChange={() => {}}
          />
        </div>
      )}
    </div>
  );
};
