
import { SimpleFileDisplay } from "../shared/SimpleFileDisplay";
import { FileUploadField } from "../shared/FileUploadField";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Task } from "@/lib/types";
import { TaskFormTitle } from "./TaskFormTitle";
import { TaskFormDescription } from "./TaskFormDescription";
import { TaskDateTimePicker } from "./TaskDateTimePicker";
import { TaskStatusSelect } from "./TaskStatusSelect";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimezoneValidation } from "@/hooks/useTimezoneValidation";
import { ensureNotificationPermission } from "@/utils/notificationUtils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface TaskFormFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  editingTask: Task | null;
  deadline: string | undefined;
  setDeadline: (deadline: string | undefined) => void;
  reminderAt: string | undefined;
  setReminderAt: (reminder: string | undefined) => void;
  emailReminder: boolean;
  setEmailReminder: (enabled: boolean) => void;
  status: Task['status'];
  setStatus: (status: Task['status']) => void;
}

export const TaskFormFields = ({
  title,
  setTitle,
  description,
  setDescription,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  editingTask,
  deadline,
  setDeadline,
  reminderAt,
  setReminderAt,
  emailReminder,
  setEmailReminder,
  status,
  setStatus,
}: TaskFormFieldsProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { validateDateTime } = useTimezoneValidation();
  const isMobile = useMediaQuery("(max-width: 640px)");
  
  // Fixed query to properly fetch task files
  const { data: existingFiles = [], refetch } = useQuery({
    queryKey: ['taskFiles', editingTask?.id],
    queryFn: async () => {
      if (!editingTask?.id) return [];
      console.log('Fetching files for task:', editingTask.id);
      
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', editingTask.id);
      
      if (error) {
        console.error('Error fetching task files:', error);
        throw error;
      }
      
      console.log('Task files found:', data);
      return data || [];
    },
    enabled: !!editingTask?.id,
  });

  const handleFileDeleted = () => {
    refetch();
    toast({
      title: t("common.success"),
      description: t("common.fileDeleted"),
    });
  };

  const handleReminderChange = async (newReminder: string | undefined) => {
    if (newReminder && deadline) {
      const validationResult = await validateDateTime(
        newReminder,
        'reminder',
        deadline
      );
      
      if (!validationResult.valid) {
        toast({
          title: t("common.warning"),
          description: validationResult.message || "Reminder must be before deadline",
          variant: "destructive",
        });
        return;
      }
    }

    // Request notification permission when setting a reminder
    if (newReminder) {
      await ensureNotificationPermission();
    }

    setReminderAt(newReminder);
    
    // CRITICAL: Force enable email reminder when reminder is set and keep it enabled
    if (newReminder) {
      console.log('🔔 CRITICAL: Enabling email reminder for task with reminder set at:', newReminder);
      setEmailReminder(true);
      
      // If editing existing task, immediately update the database to persist the setting
      if (editingTask?.id) {
        console.log('🔄 Updating existing task to preserve email reminder setting');
        try {
          const { error } = await supabase
            .from('tasks')
            .update({ 
              reminder_at: newReminder,
              email_reminder_enabled: true // Force enable regardless of current status
            })
            .eq('id', editingTask.id);
            
          if (error) {
            console.error('❌ Failed to update task reminder settings:', error);
          } else {
            console.log('✅ Successfully updated task reminder settings in database');
          }
        } catch (error) {
          console.error('❌ Exception updating task reminder:', error);
        }
      }
    } else {
      console.log('🔕 Disabling email reminder as reminder was removed');
      setEmailReminder(false);
    }
  };

  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";

  const sectionClassName = isMobile 
    ? "bg-muted/30 rounded-lg p-1.5 border border-muted/40"
    : "bg-muted/30 rounded-lg p-4 border border-muted/40";
  
  const containerClassName = isMobile ? "space-y-0.5" : "space-y-6";

  return (
    <div className={containerClassName}>
      <div className={sectionClassName}>
        <TaskFormTitle title={title} setTitle={setTitle} />
      </div>
      
      <div className={sectionClassName}>
        <TaskFormDescription description={description} setDescription={setDescription} />
      </div>

      <div className={sectionClassName}>
        <TaskStatusSelect status={status} setStatus={setStatus} />
      </div>
      
      <div className={`${sectionClassName} ${isMobile ? 'space-y-0.5' : 'space-y-4'}`}>
        <TaskDateTimePicker
          label="Deadline"
          value={deadline}
          onChange={setDeadline}
          placeholder="Set deadline (optional)"
          type="deadline"
        />
        
        <TaskDateTimePicker
          label="Reminder"
          value={reminderAt}
          onChange={handleReminderChange}
          placeholder="Set reminder (optional)"
          type="reminder"
          deadlineValue={deadline}
          emailReminder={emailReminder}
          onEmailReminderChange={setEmailReminder}
        />
      </div>
      
      {editingTask?.id && existingFiles && existingFiles.length > 0 && (
        <div className={sectionClassName}>
          <SimpleFileDisplay 
            files={existingFiles} 
            parentType="task"
            allowDelete
            onFileDeleted={handleFileDeleted}
            parentId={editingTask.id}
          />
        </div>
      )}
      
      <div className={sectionClassName}>
        <FileUploadField 
          onChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
          acceptedFileTypes={acceptedFormats}
        />
      </div>
    </div>
  );
};
