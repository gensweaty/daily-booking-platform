
import { format } from "date-fns";
import { Clock, Calendar as CalendarIcon, Bell } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskDateInfoProps {
  deadline?: string;
  reminderAt?: string;
  compact?: boolean;
}

export const TaskDateInfo = ({ deadline, reminderAt, compact = false }: TaskDateInfoProps) => {
  const { t, language } = useLanguage();
  
  if (!deadline && !reminderAt) return null;

  const formatDateTime = (dateTime: string) => {
    if (compact) {
      return format(new Date(dateTime), "MMM dd, HH:mm");
    }
    return format(new Date(dateTime), "MMM dd, yyyy 'at' HH:mm");
  };

  const isDateTimePast = (dateTime: string) => {
    return new Date(dateTime) < new Date();
  };

  const getDeadlineColor = (deadline: string) => {
    return isDateTimePast(deadline) ? "text-red-500" : "text-green-500";
  };

  const getDueLabel = () => {
    switch (language) {
      case 'ka':
        return 'დედლაინი';
      case 'es':
        return 'Pendiente';
      default:
        return 'Due';
    }
  };

  const getReminderLabel = () => {
    switch (language) {
      case 'ka':
        return 'შეხსენება';
      case 'es':
        return 'Recordatorio';
      default:
        return 'Reminder';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {deadline && (
          <div className="flex items-center gap-1">
            <Clock className={`h-3 w-3 ${getDeadlineColor(deadline)}`} />
            <span className={getDeadlineColor(deadline)}>
              {getDueLabel()}: {formatDateTime(deadline)}
            </span>
          </div>
        )}
        {reminderAt && (
          <div className="flex items-center gap-1">
            <Bell className="h-3 w-3 text-yellow-500" />
            <span className="text-yellow-500">
              {getReminderLabel()}: {formatDateTime(reminderAt)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {deadline && (
        <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5 text-sm ring-1 ring-border/50">
          <Clock className={`h-3.5 w-3.5 flex-shrink-0 ${getDeadlineColor(deadline)}`} />
          <span className="font-medium text-foreground">{getDueLabel()}:</span>
          <span className={`font-medium truncate ${getDeadlineColor(deadline)}`}>
            {formatDateTime(deadline)}
          </span>
        </div>
      )}
      {reminderAt && (
        <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5 text-sm ring-1 ring-border/50">
          <Bell className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          <span className="font-medium text-foreground">{getReminderLabel()}:</span>
          <span className="font-medium truncate text-amber-500">
            {formatDateTime(reminderAt)}
          </span>
        </div>
      )}
    </div>
  );
};
