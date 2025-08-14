import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { Task } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { TaskFormHeader } from "./TaskFormHeader";
import { TaskFormFields } from "./TaskFormFields";
import { useTimezoneValidation } from "@/hooks/useTimezoneValidation";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface PublicAddTaskFormProps {
  onClose: () => void;
  editingTask?: Task | null;
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
}

export const PublicAddTaskForm = ({ 
  onClose, 
  editingTask, 
  boardUserId,
  externalUserName,
  externalUserEmail 
}: PublicAddTaskFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileError, setFileError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deadline, setDeadline] = useState<string | undefined>();
  const [reminderAt, setReminderAt] = useState<string | undefined>();
  const [emailReminder, setEmailReminder] = useState(false);
  const [status, setStatus] = useState<Task['status']>('todo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { validateDateTime } = useTimezoneValidation();
  const isMobile = useMediaQuery("(max-width: 640px)");

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || "");
      setDeadline(editingTask.deadline_at);
      setReminderAt(editingTask.reminder_at);
      setEmailReminder(editingTask.email_reminder_enabled || false);
      setStatus(editingTask.status);
    }
  }, [editingTask]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    console.log('🎯 PublicAddTaskForm submit started:', {
      boardUserId,
      externalUserName,
      externalUserEmail,
      title,
      description,
      status,
      deadline,
      reminderAt,
      emailReminder,
      editingTask: !!editingTask
    });

    try {
      if (!title.trim()) {
        toast({
          title: "Error",
          description: t("tasks.titleRequired"),
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      // Validate deadline if provided
      if (deadline) {
        const deadlineValidation = await validateDateTime(deadline, 'deadline');
        if (!deadlineValidation.valid) {
          toast({
            title: "Invalid Deadline",
            description: deadlineValidation.message,
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Validate reminder if provided
      if (reminderAt) {
        const reminderValidation = await validateDateTime(
          reminderAt, 
          'reminder', 
          deadline
        );
        if (!reminderValidation.valid) {
          toast({
            title: "Invalid Reminder",
            description: reminderValidation.message,
            variant: "destructive"
          });
          setIsSubmitting(false);
          return;
        }
      }

      const taskData = {
        title,
        description,
        status: status,
        user_id: boardUserId,
        position: editingTask?.position || 0,
        deadline_at: deadline && deadline.trim() !== '' ? deadline : null,
        reminder_at: reminderAt && reminderAt.trim() !== '' ? reminderAt : null,
        email_reminder_enabled: emailReminder && reminderAt ? emailReminder : false,
        external_user_email: externalUserEmail, // Store external user email for reminders
        ...(editingTask ? {
          // External user editing
          last_edited_by_type: 'external_user',
          last_edited_by_name: `${externalUserName} (Sub User)`,
          last_edited_at: new Date().toISOString()
        } : {
          // External user creating
          created_by_type: 'external_user',
          created_by_name: `${externalUserName} (Sub User)`,
          last_edited_by_type: 'external_user',
          last_edited_by_name: `${externalUserName} (Sub User)`,
          last_edited_at: new Date().toISOString()
        })
      };

      console.log('📝 Task data prepared:', taskData);

      let taskResponse;
      if (editingTask) {
        console.log('🔄 Updating existing task:', editingTask.id);
        const { data, error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', editingTask.id)
          .eq('user_id', boardUserId)
          .select()
          .single();

        if (error) {
          console.error('❌ Task update error:', error);
          throw error;
        }
        taskResponse = data;
        console.log('✅ Task updated successfully:', taskResponse);
      } else {
        console.log('➕ Creating new task');
        const { data, error } = await supabase
          .from('tasks')
          .insert(taskData)
          .select()
          .single();

        if (error) {
          console.error('❌ Task creation error:', error);
          throw error;
        }
        taskResponse = data;
        console.log('✅ Task created successfully:', taskResponse);
      }

      // Handle file upload with proper bucket assignment
      if (selectedFile && taskResponse) {
        console.log('Uploading file for task:', taskResponse.id);
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        // Upload to task_attachments bucket
        const { error: uploadError } = await supabase.storage
          .from('task_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('File upload error:', uploadError);
          throw uploadError;
        }

        console.log('File uploaded successfully, creating database record');
        
        // Create file record in files table
        const { error: fileRecordError } = await supabase
          .from('files')
          .insert({
            task_id: taskResponse.id,
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: boardUserId,
            source: 'task',
            parent_type: 'task'
          });

        if (fileRecordError) {
          console.error('File record creation error:', fileRecordError);
          throw fileRecordError;
        }

        console.log('File record created successfully');
      }

      await queryClient.invalidateQueries({ queryKey: ['publicTasks', boardUserId] });
      await queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      
      // Notify other public sessions viewing this board
      const ch = supabase.channel(`public_board_tasks_${boardUserId}`);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'tasks-changed', payload: { ts: Date.now() } });
          supabase.removeChannel(ch);
        }
      });
      
      toast({
        title: t("common.success"),
        description: editingTask ? t("tasks.taskUpdated") : t("tasks.taskAdded"),
      });
      
      console.log('✅ Task operation completed successfully');
      onClose();
    } catch (error: any) {
      console.error('❌ Task operation error:', {
        error: error.message,
        details: error,
        taskData: {
          title,
          description,
          status,
          boardUserId,
          externalUserName,
          externalUserEmail
        }
      });
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingTask ? 'update' : 'create'} task. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full ${isMobile ? 'space-y-1 px-1 pb-1' : 'space-y-3 sm:space-y-6 p-2 sm:p-4'}`}>
      <TaskFormHeader editingTask={editingTask} />
      <form onSubmit={handleSubmit} className={isMobile ? 'space-y-1' : 'space-y-3 sm:space-y-6'}>
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
          deadline={deadline}
          setDeadline={setDeadline}
          reminderAt={reminderAt}
          setReminderAt={setReminderAt}
          emailReminder={emailReminder}
          setEmailReminder={setEmailReminder}
          status={status}
          setStatus={setStatus}
        />
        <div className={`flex justify-end gap-1 sm:gap-2 ${isMobile ? 'pt-1 border-t border-muted/20 mt-0' : 'pt-2 sm:pt-4 border-t border-muted/20'}`}>
          <Button type="submit" className="text-xs px-2 py-1 sm:px-3 sm:py-2" disabled={isSubmitting}>
            {isSubmitting 
              ? t("common.saving")
              : (editingTask ? t("tasks.editTask") : t("tasks.addTask"))
            }
          </Button>
        </div>
      </form>
    </div>
  );
};