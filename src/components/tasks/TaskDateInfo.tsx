
import { format } from "date-fns";
import { Clock, Calendar as CalendarIcon, Bell } from "lucide-react";

interface TaskDateInfoProps {
  deadline?: string;
  reminderAt?: string;
  compact?: boolean;
}

export const TaskDateInfo = ({ deadline, reminderAt, compact = false }: TaskDateInfoProps) => {
  if (!deadline && !reminderAt) return null;

  const formatDateTime = (dateTime: string) => {
    return format(new Date(dateTime), "MMM dd, yyyy 'at' HH:mm");
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {deadline && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Due: {format(new Date(deadline), "MMM dd")}</span>
          </div>
        )}
        {reminderAt && (
          <div className="flex items-center gap-1">
            <Bell className="h-3 w-3" />
            <span>Reminder: {format(new Date(reminderAt), "MMM dd")}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deadline && (
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-red-500" />
          <span className="font-medium">Deadline:</span>
          <span>{formatDateTime(deadline)}</span>
        </div>
      )}
      {reminderAt && (
        <div className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4 text-blue-500" />
          <span className="font-medium">Reminder:</span>
          <span>{formatDateTime(reminderAt)}</span>
        </div>
      )}
    </div>
  );
};
