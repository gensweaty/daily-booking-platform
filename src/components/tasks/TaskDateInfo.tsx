
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

  const isDateTimePast = (dateTime: string) => {
    return new Date(dateTime) < new Date();
  };

  const getDeadlineColor = (deadline: string) => {
    return isDateTimePast(deadline) ? "text-red-500" : "text-green-500";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {deadline && (
          <div className="flex items-center gap-1">
            <Clock className={`h-3 w-3 ${getDeadlineColor(deadline)}`} />
            <span className={getDeadlineColor(deadline)}>
              Due: {format(new Date(deadline), "MMM dd")}
            </span>
          </div>
        )}
        {reminderAt && (
          <div className="flex items-center gap-1">
            <Bell className="h-3 w-3 text-yellow-500" />
            <span className="text-yellow-500">
              Reminder: {format(new Date(reminderAt), "MMM dd")}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deadline && (
        <div className="flex items-center gap-2 text-sm">
          <Clock className={`h-4 w-4 ${getDeadlineColor(deadline)}`} />
          <span className="font-medium">Deadline:</span>
          <span className={getDeadlineColor(deadline)}>
            {formatDateTime(deadline)}
          </span>
        </div>
      )}
      {reminderAt && (
        <div className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">Reminder:</span>
          <span className="text-yellow-500">
            {formatDateTime(reminderAt)}
          </span>
        </div>
      )}
    </div>
  );
};
