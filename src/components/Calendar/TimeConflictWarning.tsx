
import { AlertTriangle, Calendar, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimeConflictWarningProps {
  conflicts: Array<{ type: 'event' | 'booking'; title: string; start: string; end: string }>;
}

export const TimeConflictWarning = ({ conflicts }: TimeConflictWarningProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  if (conflicts.length === 0) return null;

  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="space-y-2">
        <div className="font-medium">
          {isGeorgian ? "დროის კონფლიქტი აღმოჩენილია" : "Time conflict detected"}
        </div>
        <div className="text-sm text-amber-700">
          {isGeorgian 
            ? "შემდეგი ღონისძიებები იმავე დროს ხდება:" 
            : "The following events are scheduled at the same time:"}
        </div>
        <div className="space-y-1">
          {conflicts.map((conflict, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              {conflict.type === 'event' ? (
                <Calendar className="h-3 w-3 text-amber-600" />
              ) : (
                <Clock className="h-3 w-3 text-amber-600" />
              )}
              <span className="font-medium">{conflict.title}</span>
              <span className="text-amber-600">
                {format(new Date(conflict.start), "HH:mm")} - {format(new Date(conflict.end), "HH:mm")}
              </span>
            </div>
          ))}
        </div>
        <div className="text-xs text-amber-600 mt-2">
          {isGeorgian 
            ? "მიუხედავად ამისა, შეგიძლიათ ღონისძიება შექმნათ." 
            : "You can still proceed to create the event if needed."}
        </div>
      </AlertDescription>
    </Alert>
  );
};
