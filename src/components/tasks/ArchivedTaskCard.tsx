
import { Task } from "@/lib/types";
import { Calendar, Clock, FileText, Archive, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";

interface ArchivedTaskCardProps {
  task: Task;
  onView: (task: Task) => void;
  onRestore: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export const ArchivedTaskCard = ({ task, onView, onRestore, onDelete }: ArchivedTaskCardProps) => {
  const { t } = useLanguage();

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return null;
    
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inprogress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'done': return t('tasks.done');
      case 'inprogress': return t('tasks.inProgress');
      default: return t('tasks.todo');
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold cursor-pointer hover:text-primary" onClick={() => onView(task)}>
            {task.title}
          </CardTitle>
          <Badge className={getStatusColor(task.status)}>
            <LanguageText>{getStatusText(task.status)}</LanguageText>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {task.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Archive className="h-3 w-3" />
            <span>
              <LanguageText>{t("tasks.archived")}</LanguageText> {formatDate(task.archived_at)}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              <LanguageText>{t("tasks.created")}</LanguageText> {formatDate(task.created_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {task.deadline_at && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span><LanguageText>{t("tasks.deadline")}</LanguageText></span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span>1 {t("tasks.file")}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestore(task.id)}
              className="h-8 px-2"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              <LanguageText>{t("tasks.restore")}</LanguageText>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(task.id)}
              className="h-8 px-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              <LanguageText>{t("common.delete")}</LanguageText>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
