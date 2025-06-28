
import { Task } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, Trash2, Archive, Calendar, Clock, Paperclip } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow, format, isAfter } from "date-fns";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
}

export const TaskCard = ({ task, onEdit, onView, onDelete, onArchive }: TaskCardProps) => {
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

  const isOverdue = task.deadline_at && isAfter(new Date(), new Date(task.deadline_at));
  const isUpcoming = task.deadline_at && !isOverdue;

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
              {task.deadline_at && (
                <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : isUpcoming ? 'text-amber-600' : ''}`}>
                  <Calendar className="h-3 w-3" />
                  {isOverdue ? (
                    <span>Overdue: {formatDate(task.deadline_at)}</span>
                  ) : (
                    <span>Due: {formatDate(task.deadline_at)}</span>
                  )}
                </div>
              )}
              
              {task.reminder_at && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Clock className="h-3 w-3" />
                  <span>Reminder: {formatDistanceToNow(new Date(task.reminder_at))} ago</span>
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(task)}>
                <Eye className="mr-2 h-4 w-4" />
                {t("common.view") || "View"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Edit className="mr-2 h-4 w-4" />
                {t("tasks.editTask")}
              </DropdownMenuItem>
              {onArchive && (
                <DropdownMenuItem onClick={() => onArchive(task.id)}>
                  <Archive className="mr-2 h-4 w-4" />
                  {t("tasks.archive")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};
