
import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";

interface TaskDateInfoProps {
  deadline?: string | null;
  reminder?: string | null;
}

export const TaskDateInfo = ({ deadline, reminder }: TaskDateInfoProps) => {
  if (!deadline && !reminder) return null;

  return (
    <div className="flex flex-col gap-1 mt-2 text-xs text-muted-foreground">
      {deadline && (
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Deadline: {format(new Date(deadline), "MMM d, HH:mm")}</span>
        </div>
      )}
      {reminder && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Reminder: {format(new Date(reminder), "MMM d, HH:mm")}</span>
        </div>
      )}
    </div>
  );
};
