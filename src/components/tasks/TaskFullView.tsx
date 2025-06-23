
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, FileText } from "lucide-react";
import { Task } from "@/lib/types";
import { FileDisplay } from "../shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { TaskDateInfo } from "./TaskDateInfo";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskFullViewProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
}

export const TaskFullView = ({ task, isOpen, onClose, onEdit, onDelete }: TaskFullViewProps) => {
  const { t } = useLanguage();
  
  const { data: files = [] } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!task.id,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-800';
      case 'inprogress': return 'bg-blue-100 text-blue-800';
      case 'done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'todo': return t("tasks.todo");
      case 'inprogress': return t("tasks.inProgress");
      case 'done': return t("tasks.done");
      default: return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-foreground">{task.title}</span>
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(task)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
              {getStatusText(task.status)}
            </span>
          </div>
          
          {task.description && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Description</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-6">
                {task.description}
              </p>
            </div>
          )}

          <TaskDateInfo 
            deadline={task.deadline_at}
            reminder={task.reminder_at}
          />
          
          {files.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-foreground">Attachments</h4>
              <FileDisplay 
                files={files} 
                bucketName="event_attachments"
                fallbackBuckets={["customer_attachments"]}
              />
            </div>
          )}
          
          <div className="text-xs text-muted-foreground">
            Created: {new Date(task.created_at).toLocaleDateString()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
