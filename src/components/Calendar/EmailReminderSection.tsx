
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface EmailReminderSectionProps {
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (enabled: boolean) => void;
  reminderAt?: string;
  setReminderAt: (time: string | undefined) => void;
  isNewEvent: boolean;
}

export const EmailReminderSection = ({
  emailReminderEnabled,
  setEmailReminderEnabled,
  reminderAt,
  setReminderAt,
  isNewEvent
}: EmailReminderSectionProps) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

  console.log("EmailReminderSection render:", { emailReminderEnabled, reminderAt });

  const handleReminderToggle = (checked: boolean) => {
    console.log("EmailReminderSection: Toggling reminder to", checked);
    setEmailReminderEnabled(checked);
    
    if (!checked) {
      setReminderAt(undefined);
    }
  };

  const handleReminderTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    console.log("EmailReminderSection: Setting reminder time to", newTime);
    setReminderAt(newTime || undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="email-reminder"
          checked={emailReminderEnabled}
          onCheckedChange={handleReminderToggle}
        />
        <Label htmlFor="email-reminder" className="text-sm font-medium">
          {isGeorgian ? (
            <GeorgianAuthText>ელ. ფოსტის შეხსენება</GeorgianAuthText>
          ) : (
            <LanguageText>Email Reminder</LanguageText>
          )}
        </Label>
      </div>

      {emailReminderEnabled && (
        <div className="space-y-2">
          <Label htmlFor="reminder-time" className="text-sm font-medium">
            {isGeorgian ? (
              <GeorgianAuthText>შეხსენების დრო</GeorgianAuthText>
            ) : (
              <LanguageText>Reminder Time</LanguageText>
            )}
          </Label>
          <Input
            id="reminder-time"
            type="datetime-local"
            value={reminderAt || ""}
            onChange={handleReminderTimeChange}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};
