
import { Task } from "@/lib/types";
import { RefreshCw, Paperclip, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ArchivedTaskCardProps {
  task: Task;
  onView: (task: Task) => void;
  onRestore: (id: string) => void;
}

export const ArchivedTaskCard = ({ task, onView, onRestore }: ArchivedTaskCardProps) => {
  const { t } = useLanguage();
  
  const { data: files } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id);
      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">{t("tasks.completed")}</Badge>;
      case 'inprogress':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100">{t("tasks.inProgress")}</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">{t("tasks.todo")}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM dd, yyyy HH:mm');
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0" onClick={() => onView(task)}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-foreground truncate">{task.title}</h3>
              {getStatusBadge(task.status)}
            </div>
            
            {task.description && (
              <div 
                className="text-sm text-muted-foreground line-clamp-2 mb-2"
                dangerouslySetInnerHTML={{ __html: task.description }}
              />
            )}
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {task.archived_at && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{t("tasks.archivedAgo")} {formatDistanceToNow(new Date(task.archived_at))} ago</span>
                </div>
              )}
              
              {task.deadline_at && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Due: {formatDate(task.deadline_at)}</span>
                </div>
              )}
              
              {files && files.length > 0 && (
                <div className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  <span>{files.length} file{files.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRestore(task.id);
            }}
            className="ml-2 flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            {t("tasks.restore")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
