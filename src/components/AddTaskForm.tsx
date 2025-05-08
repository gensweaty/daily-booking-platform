import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createTask, updateTask } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TaskFormHeader } from "@/components/tasks/TaskFormHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { Task } from "@/lib/types";
import { TaskFormFields } from "@/components/tasks/TaskFormFields";
import { supabase } from "@/lib/supabase";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
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
    
    // Reset file state
    setSelectedFile(null);
    setFileError("");
  }, [editingTask, initialColumn, isOpen]);

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
      let taskId: string;
      
      if (editingTask) {
        // Update existing task
        await updateTask(editingTask.id, {
          title,
          description,
          status,
        });
        
        taskId = editingTask.id;
        
        toast({
          title: t("tasks.taskUpdated"),
          description: t("tasks.taskUpdatedDescription")
        });
      } else {
        // Create new task
        // Get the maximum position value for tasks with the current status
        const response = await fetch('/api/tasks/max-position?status=' + status);
        const maxPosition = response.ok ? await response.json() : { position: 0 };
        
        const newTask = await createTask({
          title,
          description,
          status,
          user_id: user.id,
          position: maxPosition.position + 1 // Use position instead of order
        });
        
        taskId = newTask.id;
        
        toast({
          title: t("tasks.taskCreated"),
          description: t("tasks.taskCreatedDescription")
        });
      }
      
      // Handle file upload if a file is selected
      if (selectedFile && taskId) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${taskId}/${crypto.randomUUID()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }

          // Create file record
          const { error: fileRecordError } = await supabase
            .from('files')
            .insert({
              task_id: taskId,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size,
              user_id: user.id
            });
            
          if (fileRecordError) {
            console.error('Error creating file record:', fileRecordError);
            throw fileRecordError;
          }
        } catch (fileError) {
          console.error("Error handling file upload:", fileError);
          toast({
            title: t("common.warning"),
            description: t("common.fileUploadError"),
            variant: "destructive",
          });
        }
      }
      
      setTitle("");
      setDescription("");
      setSelectedFile(null);
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
          <TaskFormFields 
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            editingTask={editingTask}
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
