import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { PersonData } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTimezoneValidation } from "@/hooks/useTimezoneValidation";

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
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (enabled: boolean) => void;
  reminderAt: string;
  setReminderAt: (time: string) => void;
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
  emailReminderEnabled,
  setEmailReminderEnabled,
  reminderAt,
  setReminderAt,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const { toast } = useToast();
  const { validateDateTime, isValidating } = useTimezoneValidation();

  const handleDeleteFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('event_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      setExistingFiles(prev => prev.filter(f => f.id !== fileId));
      
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const handleReminderToggle = (checked: boolean) => {
    setEmailReminderEnabled(checked);
    if (checked && startDate) {
      // Set default reminder to 1 hour before start time
      const startDateTime = new Date(startDate);
      startDateTime.setHours(startDateTime.getHours() - 1);
      setReminderAt(startDateTime.toISOString().slice(0, 16));
    } else {
      setReminderAt('');
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="userSurname" className={cn(isGeorgian ? "font-georgian" : "")}>
          {isGeorgian ? (
            <GeorgianAuthText>სრული სახელი</GeorgianAuthText>
          ) : (
            <LanguageText>{t("events.fullName")}</LanguageText>
          )}
        </Label>
        <Input
          id="userSurname"
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="userNumber" className={cn(isGeorgian ? "font-georgian" : "")}>
          {isGeorgian ? (
            <GeorgianAuthText>ტელეფონის ნომერი</GeorgianAuthText>
          ) : (
            <LanguageText>{t("events.phoneNumber")}</LanguageText>
          )}
        </Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="socialNetworkLink" className={cn(isGeorgian ? "font-georgian" : "")}>
          {isGeorgian ? (
            <GeorgianAuthText>სოციალური ქსელის ლინკი</GeorgianAuthText>
          ) : (
            <LanguageText>{t("events.socialLink")}</LanguageText>
          )}
        </Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="eventName" className={cn(isGeorgian ? "font-georgian" : "")}>
          {isGeorgian ? (
            <GeorgianAuthText>ღონისძიების სახელი</GeorgianAuthText>
          ) : (
            <LanguageText>{t("events.eventName")}</LanguageText>
          )}
        </Label>
        <Input
          id="eventName"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="startDate" className={cn(isGeorgian ? "font-georgian" : "")}>
            {isGeorgian ? (
              <GeorgianAuthText>დაწყების თარიღი</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.startDate")}</LanguageText>
            )}
          </Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="endDate" className={cn(isGeorgian ? "font-georgian" : "")}>
            {isGeorgian ? (
              <GeorgianAuthText>დასრულების თარიღი</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.endDate")}</LanguageText>
            )}
          </Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="paymentStatus" className={cn(isGeorgian ? "font-georgian" : "")}>
            {isGeorgian ? (
              <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.paymentStatus")}</LanguageText>
            )}
          </Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">
                {isGeorgian ? (
                  <GeorgianAuthText>არ არის გადახდილი</GeorgianAuthText>
                ) : (
                  <LanguageText>{t("events.notPaid")}</LanguageText>
                )}
              </SelectItem>
              <SelectItem value="partly_paid">
                {isGeorgian ? (
                  <GeorgianAuthText>ნაწილობრივ გადახდილი</GeorgianAuthText>
                ) : (
                  <LanguageText>{t("events.partlyPaid")}</LanguageText>
                )}
              </SelectItem>
              <SelectItem value="fully_paid">
                {isGeorgian ? (
                  <GeorgianAuthText>სრულად გადახდილი</GeorgianAuthText>
                ) : (
                  <LanguageText>{t("events.fullyPaid")}</LanguageText>
                )}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="paymentAmount" className={cn(isGeorgian ? "font-georgian" : "")}>
            {isGeorgian ? (
              <GeorgianAuthText>გადახდის რაოდენობა</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.paymentAmount")}</LanguageText>
            )}
          </Label>
          <Input
            id="paymentAmount"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="eventNotes" className={cn(isGeorgian ? "font-georgian" : "")}>
          {isGeorgian ? (
            <GeorgianAuthText>შენიშვნები</GeorgianAuthText>
          ) : (
            <LanguageText>{t("events.notes")}</LanguageText>
          )}
        </Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className={cn(isGeorgian ? "font-georgian" : "")}
        />
      </div>

      {/* Recurring Event Section */}
      {!isBookingRequest && isNewEvent && (
        <div className="space-y-3 p-4 border rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isRecurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
            <Label htmlFor="isRecurring" className={cn("text-sm font-medium", isGeorgian ? "font-georgian" : "")}>
              {isGeorgian ? (
                <GeorgianAuthText>განმეორებადი ღონისძიება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("events.makeRecurring")}</LanguageText>
              )}
            </Label>
          </div>

          {isRecurring && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="grid gap-2">
                <Label htmlFor="repeatPattern" className={cn(isGeorgian ? "font-georgian" : "")}>
                  {isGeorgian ? (
                    <GeorgianAuthText>განმეორების ტიპი</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t("events.repeatPattern")}</LanguageText>
                  )}
                </Label>
                <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">
                      {isGeorgian ? (
                        <GeorgianAuthText>ყოველდღე</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("events.daily")}</LanguageText>
                      )}
                    </SelectItem>
                    <SelectItem value="weekly">
                      {isGeorgian ? (
                        <GeorgianAuthText>ყოველკვირეულად</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("events.weekly")}</LanguageText>
                      )}
                    </SelectItem>
                    <SelectItem value="biweekly">
                      {isGeorgian ? (
                        <GeorgianAuthText>ორ კვირაში ერთხელ</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("events.biweekly")}</LanguageText>
                      )}
                    </SelectItem>
                    <SelectItem value="monthly">
                      {isGeorgian ? (
                        <GeorgianAuthText>ყოველთვიურად</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("events.monthly")}</LanguageText>
                      )}
                    </SelectItem>
                    <SelectItem value="yearly">
                      {isGeorgian ? (
                        <GeorgianAuthText>ყოველწლიურად</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("events.yearly")}</LanguageText>
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="repeatUntil" className={cn(isGeorgian ? "font-georgian" : "")}>
                  {isGeorgian ? (
                    <GeorgianAuthText>განმეორება მდე</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t("events.repeatUntil")}</LanguageText>
                  )}
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

      {/* Email Reminder Section */}
      <div className="space-y-3 p-4 border rounded-lg">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="emailReminder"
            checked={emailReminderEnabled}
            onCheckedChange={handleReminderToggle}
          />
          <Label htmlFor="emailReminder" className={cn("text-sm font-medium", isGeorgian ? "font-georgian" : "")}>
            <span role="img" aria-label="reminder" className="mr-1">🔔</span>
            {isGeorgian ? (
              <GeorgianAuthText>ელ-ფოსტით შეხსენება</GeorgianAuthText>
            ) : (
              <LanguageText>Email Reminder</LanguageText>
            )}
          </Label>
        </div>

        {emailReminderEnabled && (
          <div className="grid gap-2 mt-3">
            <Label htmlFor="reminderAt" className={cn(isGeorgian ? "font-georgian" : "")}>
              {isGeorgian ? (
                <GeorgianAuthText>შეხსენების დრო</GeorgianAuthText>
              ) : (
                <LanguageText>Reminder Time</LanguageText>
              )}
            </Label>
            <Input
              id="reminderAt"
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              max={startDate} // Cannot set reminder after event start
            />
            {reminderAt && startDate && new Date(reminderAt) >= new Date(startDate) && (
              <p className="text-sm text-red-500">
                {isGeorgian ? (
                  <GeorgianAuthText>შეხსენება ღონისძიების დაწყებამდე უნდა იყოს</GeorgianAuthText>
                ) : (
                  <LanguageText>Reminder must be before event start time</LanguageText>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* File Upload Section */}
      <FileUploadField
        files={files}
        setFiles={setFiles}
        eventId={eventId}
      />

      {/* Existing Files Display */}
      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <Label className={cn(isGeorgian ? "font-georgian" : "")}>
            {isGeorgian ? (
              <GeorgianAuthText>ატვირთული ფაილები</GeorgianAuthText>
            ) : (
              <LanguageText>Uploaded Files</LanguageText>
            )}
          </Label>
          <FileDisplay
            files={existingFiles}
            onDelete={handleDeleteFile}
          />
        </div>
      )}
    </div>
  );
};
