
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TaskFormTitle } from "@/components/tasks/TaskFormTitle";
import { TaskFormDescription } from "@/components/tasks/TaskFormDescription";
import { TaskFormHeader } from "@/components/tasks/TaskFormHeader";
import { useLanguage } from "@/contexts/LanguageContext";

interface AddTaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialColumn?: string;
}

export const AddTaskForm = ({ isOpen, onClose, onSuccess, initialColumn = "todo" }: AddTaskFormProps) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(initialColumn as "todo" | "inprogress" | "done");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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
      
      setTitle("");
      setDescription("");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: t("common.error"),
        description: t("tasks.errorCreatingTask"),
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
          <TaskFormHeader titleKey="tasks.addTask" />
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
              {isSubmitting ? t("common.submitting") : t("tasks.addTask")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
