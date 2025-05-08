
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask, updateTask } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TaskFormTitle } from "@/components/tasks/TaskFormTitle";
import { TaskFormDescription } from "@/components/tasks/TaskFormDescription";
import { TaskFormHeader } from "@/components/tasks/TaskFormHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { Task } from "@/lib/types";

interface AddTaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialColumn?: string;
  editingTask?: Task | null;
}

export const AddTaskForm = ({ isOpen, onClose, onSuccess, initialColumn = "todo", editingTask }: AddTaskFormProps) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(initialColumn as "todo" | "inprogress" | "done");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Initialize form when editing an existing task
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || "");
      setStatus(editingTask.status);
    } else {
      // Reset form when not editing
      setTitle("");
      setDescription("");
      setStatus(initialColumn as "todo" | "inprogress" | "done");
    }
  }, [editingTask, initialColumn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: t("common.error"),
        description: t("tasks.notLoggedIn"),
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: t("common.error"),
        description: t("tasks.titleRequired"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (editingTask) {
        // Update existing task
        await updateTask(editingTask.id, {
          title,
          description,
          status,
        });
        
        toast({
          title: t("tasks.taskUpdated"),
          description: t("tasks.taskUpdatedDescription")
        });
      } else {
        // Create new task
        // Get the maximum order value for tasks with the current status
        const response = await fetch('/api/tasks/max-order?status=' + status);
        const maxOrder = response.ok ? await response.json() : { order: 0 };
        
        await createTask({
          title,
          description,
          status,
          user_id: user.id,
          order: maxOrder.order + 1 // Use order instead of position
        });
        
        toast({
          title: t("tasks.taskCreated"),
          description: t("tasks.taskCreatedDescription")
        });
      }
      
      setTitle("");
      setDescription("");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating/updating task:", error);
      toast({
        title: t("common.error"),
        description: editingTask 
          ? t("tasks.errorUpdatingTask")
          : t("tasks.errorCreatingTask"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogTitle>
          <TaskFormHeader 
            titleKey={editingTask ? "tasks.editTask" : "tasks.addTask"} 
          />
        </DialogTitle>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <TaskFormTitle 
            title={title} 
            setTitle={setTitle} 
          />
          
          <TaskFormDescription 
            description={description} 
            setDescription={setDescription} 
          />
          
          <DialogFooter className="mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting 
                ? t("common.submitting") 
                : editingTask 
                  ? t("common.update") 
                  : t("tasks.addTask")
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
