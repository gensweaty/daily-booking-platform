
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { Calendar, Bell, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

interface TaskDeadlineReminderProps {
  deadline?: Date;
  reminder?: Date;
  onDeadlineChange: (date: Date | undefined) => void;
  onReminderChange: (date: Date | undefined) => void;
}

export const TaskDeadlineReminder = ({
  deadline,
  reminder,
  onDeadlineChange,
  onReminderChange
}: TaskDeadlineReminderProps) => {
  const [showDeadline, setShowDeadline] = useState(!!deadline);
  const [showReminder, setShowReminder] = useState(!!reminder);
  const { t } = useLanguage();

  const handleDeadlineToggle = () => {
    if (showDeadline) {
      setShowDeadline(false);
      onDeadlineChange(undefined);
    } else {
      setShowDeadline(true);
    }
  };

  const handleReminderToggle = () => {
    if (showReminder) {
      setShowReminder(false);
      onReminderChange(undefined);
    } else {
      setShowReminder(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={showDeadline ? "default" : "outline"}
          size="sm"
          onClick={handleDeadlineToggle}
          className="flex items-center gap-1"
        >
          <Calendar className="h-4 w-4" />
          <LanguageText>{t("tasks.deadline")}</LanguageText>
          {showDeadline && <X className="h-3 w-3 ml-1" />}
        </Button>

        <Button
          type="button"
          variant={showReminder ? "default" : "outline"}
          size="sm"
          onClick={handleReminderToggle}
          className="flex items-center gap-1"
        >
          <Bell className="h-4 w-4" />
          <LanguageText>{t("tasks.reminder")}</LanguageText>
          {showReminder && <X className="h-3 w-3 ml-1" />}
        </Button>
      </div>

      {showDeadline && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            <LanguageText>{t("tasks.deadline")}</LanguageText>
          </label>
          <DateTimePicker
            value={deadline}
            onChange={onDeadlineChange}
            placeholder={t("tasks.selectDeadline")}
          />
        </div>
      )}

      {showReminder && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            <LanguageText>{t("tasks.reminder")}</LanguageText>
          </label>
          <DateTimePicker
            value={reminder}
            onChange={onReminderChange}
            placeholder={t("tasks.selectReminder")}
          />
        </div>
      )}
    </div>
  );
};
