
import { Calendar, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskMetadataProps {
  createdAt: string;
  updatedAt: string;
}

export const TaskMetadata = ({ createdAt, updatedAt }: TaskMetadataProps) => {
  const { t } = useLanguage();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${t("common.minutesAgo")}`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} ${t("common.hoursAgo")}`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} ${t("common.daysAgo")}`;
    }
  };

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
      <div className="flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        <span>{t("tasks.created")} {formatDate(createdAt)}</span>
      </div>
      
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        <span>{t("tasks.lastUpdated")} {formatDate(updatedAt)}</span>
      </div>
    </div>
  );
};
