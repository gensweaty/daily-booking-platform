
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Task } from "@/lib/types";
import { Edit, Archive, Trash2, Calendar, Clock, Bell } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";
import { FileDisplay } from "../shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { TaskDateInfo } from "./TaskDateInfo";

interface TaskFullViewProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onArchive: (id: string) => void;
}

export const TaskFullView = ({ task, isOpen, onClose, onDelete, onEdit, onArchive }: TaskFullViewProps) => {
  const { language, t } = useLanguage();
  const isGeorgian = language === 'ka';

  const { data: taskFiles } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id)
        .eq('source', 'task')
        .is('deleted_at', null);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!task.id && isOpen,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      case 'inprogress':
        return 'bg-blue-100 text-blue-800';
      case 'done':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'todo':
        return t("tasks.todo");
      case 'inprogress':
        return t("tasks.inProgress");
      case 'done':
        return t("tasks.done");
      default:
        return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <span className="break-words">{task.title}</span>
            <Badge className={getStatusColor(task.status)}>
              {getStatusText(task.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {task.description && (
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">
                {isGeorgian ? (
                  <GeorgianAuthText fontWeight="bold">
                    <LanguageText>{t("tasks.description")}</LanguageText>
                  </GeorgianAuthText>
                ) : (
                  <LanguageText>{t("tasks.description")}</LanguageText>
                )}
              </h4>
              <div 
                className="text-muted-foreground whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: task.description }}
              />
            </div>
          )}

          {taskFiles && taskFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">
                {isGeorgian ? (
                  <GeorgianAuthText fontWeight="bold">
                    <LanguageText>{t("tasks.attachments")}</LanguageText>
                  </GeorgianAuthText>
                ) : (
                  <LanguageText>{t("tasks.attachments")}</LanguageText>
                )}
              </h4>
              <FileDisplay 
                files={taskFiles} 
                bucketName="task_attachments"
                allowDelete={false}
                parentType="task"
              />
            </div>
          )}

          {/* Moved metadata section to bottom, before buttons */}
          <div className="pt-4 border-t border-muted/20">
            <TaskDateInfo 
              deadline={task.deadline_at}
              reminderAt={task.reminder_at}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-muted/20">
            <Button variant="outline" onClick={() => onEdit(task)}>
              <Edit className="mr-2 h-4 w-4" />
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="bold">
                  <LanguageText>{t("tasks.editTask")}</LanguageText>
                </GeorgianAuthText>
              ) : (
                <LanguageText>{t("tasks.editTask")}</LanguageText>
              )}
            </Button>
            
            <Button variant="outline" onClick={() => onArchive(task.id)}>
              <Archive className="mr-2 h-4 w-4" />
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="bold">
                  <LanguageText>{t("tasks.archive")}</LanguageText>
                </GeorgianAuthText>
              ) : (
                <LanguageText>{t("tasks.archive")}</LanguageText>
              )}
            </Button>
            
            <Button variant="destructive" onClick={() => onDelete(task.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="bold">
                  <LanguageText>{t("tasks.deleteTask")}</LanguageText>
                </GeorgianAuthText>
              ) : (
                <LanguageText>{t("tasks.deleteTask")}</LanguageText>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
