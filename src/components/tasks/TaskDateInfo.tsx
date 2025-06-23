
import { format } from "date-fns";
import { Clock, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";

interface TaskDateInfoProps {
  deadline?: string;
  reminder?: string;
  compact?: boolean;
}

export const TaskDateInfo = ({ deadline, reminder, compact = false }: TaskDateInfoProps) => {
  const { t } = useLanguage();

  if (!deadline && !reminder) return null;

  const isDeadlineOverdue = deadline && new Date(deadline) < new Date();
  const isReminderPassed = reminder && new Date(reminder) < new Date();

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {deadline && (
          <Badge 
            variant={isDeadlineOverdue ? "destructive" : "secondary"}
            className="text-xs flex items-center gap-1"
          >
            <Clock className="h-3 w-3" />
            {format(new Date(deadline), "MMM d, HH:mm")}
          </Badge>
        )}
        {reminder && (
          <Badge 
            variant={isReminderPassed ? "outline" : "default"}
            className="text-xs flex items-center gap-1"
          >
            <AlertCircle className="h-3 w-3" />
            {format(new Date(reminder), "MMM d, HH:mm")}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deadline && (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t("tasks.deadline")}:</span>
          <span className={`text-sm ${isDeadlineOverdue ? 'text-destructive' : ''}`}>
            {format(new Date(deadline), "PPP 'at' HH:mm")}
            {isDeadlineOverdue && (
              <span className="ml-1 text-destructive">({t("tasks.overdue")})</span>
            )}
          </span>
        </div>
      )}
      {reminder && (
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t("tasks.reminder")}:</span>
          <span className={`text-sm ${isReminderPassed ? 'text-muted-foreground' : ''}`}>
            {format(new Date(reminder), "PPP 'at' HH:mm")}
            {isReminderPassed && (
              <span className="ml-1 text-muted-foreground">({t("tasks.reminded")})</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};
