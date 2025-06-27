import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTask, updateTask, archiveTask } from "@/lib/api";
import { Task } from "@/lib/types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useToast } from "./ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { TaskFormFields } from "./tasks/TaskFormFields";
import { TaskFormHeader } from "./tasks/TaskFormHeader";
import { Archive } from "lucide-react";

interface AddTaskFormProps {
  onClose: () => void;
  editingTask?: Task | null;
}

export const AddTaskForm = ({ onClose, editingTask }: AddTaskFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<'todo' | 'inprogress' | 'done'>('todo');
  const [deadlineAt, setDeadlineAt] = useState<Date | undefined>();
  const [reminderAt, setReminderAt] = useState<Date | undefined>();
  
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || "");
      setStatus(editingTask.status);
      setDeadlineAt(editingTask.deadline_at ? new Date(editingTask.deadline_at) : undefined);
      setReminderAt(editingTask.reminder_at ? new Date(editingTask.reminder_at) : undefined);
    }
  }, [editingTask]);

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: t("common.success"),
        description: t("tasks.taskAdded"),
      });
      onClose();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: t("common.success"),
        description: t("tasks.taskUpdated"),
      });
      onClose();
    },
  });

  const archiveTaskMutation = useMutation({
    mutationFn: (id: string) => archiveTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archivedTasks'] });
      toast({
        title: t("common.success"),
        description: t("tasks.taskArchived"),
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to archive task",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    if (reminderAt && deadlineAt && reminderAt >= deadlineAt) {
      toast({
        title: t("common.error"),
        description: t("tasks.reminderBeforeDeadline"),
        variant: "destructive",
      });
      return;
    }

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      status,
      deadline_at: deadlineAt?.toISOString(),
      reminder_at: reminderAt?.toISOString(),
    };

    if (editingTask) {
      updateTaskMutation.mutate({
        id: editingTask.id,
        updates: taskData,
      });
    } else {
      createTaskMutation.mutate(taskData);
    }
  };

  const handleArchive = () => {
    if (editingTask) {
      archiveTaskMutation.mutate(editingTask.id);
    }
  };

  return (
    <div className="space-y-6">
      <TaskFormHeader 
        isEditing={!!editingTask}
        t={t}
      />
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <TaskFormFields
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          status={status}
          setStatus={setStatus}
          deadlineAt={deadlineAt}
          setDeadlineAt={setDeadlineAt}
          reminderAt={reminderAt}
          setReminderAt={setReminderAt}
          t={t}
        />

        <div className="flex justify-between pt-4">
          <div className="flex gap-2">
            <Button type="submit" disabled={!title.trim()}>
              {editingTask ? t("common.update") : t("common.create")}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </div>
          
          {editingTask && (
            <Button
              type="button"
              variant="outline"
              onClick={handleArchive}
              disabled={archiveTaskMutation.isPending}
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              {t("tasks.archive")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
