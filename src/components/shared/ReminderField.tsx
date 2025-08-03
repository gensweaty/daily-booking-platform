
import { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Bell } from "lucide-react";
import { TaskDateTimePicker } from "@/components/tasks/TaskDateTimePicker";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface ReminderFieldProps {
  reminderAt: string;
  setReminderAt: (value: string) => void;
  emailReminderEnabled: boolean;
  setEmailReminderEnabled: (value: boolean) => void;
  startDate?: string;
  className?: string;
}

export const ReminderField = ({
  reminderAt,
  setReminderAt,
  emailReminderEnabled,
  setEmailReminderEnabled,
  startDate,
  className
}: ReminderFieldProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const
  } : undefined;

  const handleReminderToggle = (checked: boolean) => {
    setEmailReminderEnabled(checked);
    if (!checked) {
      setReminderAt('');
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="emailReminder"
          checked={emailReminderEnabled}
          onCheckedChange={handleReminderToggle}
        />
        <Label 
          htmlFor="emailReminder" 
          className={cn("flex items-center gap-2 cursor-pointer", isGeorgian ? "font-georgian" : "")}
          style={georgianStyle}
        >
          <Bell className="h-4 w-4" />
          {isGeorgian ? (
            <GeorgianAuthText letterSpacing="-0.05px">შეხსენების ელფოსტა</GeorgianAuthText>
          ) : (
            t("tasks.emailReminder") || "Email Reminder"
          )}
        </Label>
      </div>
      
      {emailReminderEnabled && (
        <TaskDateTimePicker
          label="Reminder"
          value={reminderAt || undefined}
          onChange={(value) => setReminderAt(value || '')}
          placeholder={isGeorgian ? "შეხსენების დრო" : "Reminder time"}
          type="reminder"
          deadlineValue={startDate}
          emailReminder={emailReminderEnabled}
          onEmailReminderChange={setEmailReminderEnabled}
        />
      )}
    </div>
  );
};
