
import { SimpleFileDisplay } from "../shared/SimpleFileDisplay";
import { FileUploadField } from "../shared/FileUploadField";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Task } from "@/lib/types";
import { TaskFormTitle } from "./TaskFormTitle";
import { TaskFormDescription } from "./TaskFormDescription";
import { TaskDateTimePicker } from "./TaskDateTimePicker";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimezoneValidation } from "@/hooks/useTimezoneValidation";
import { ensureNotificationPermission } from "@/utils/notificationUtils";

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
}: TaskFormFieldsProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { validateDateTime } = useTimezoneValidation();
  
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
    
    // Enable email reminder when setting a reminder (this ensures email_reminder_enabled is always set)
    if (newReminder) {
      setEmailReminder(true);
    } else {
      // Reset email reminder if reminder is removed
      setEmailReminder(false);
    }
  };

  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";

  return (
    <div className="space-y-6">
      <div className="bg-muted/30 rounded-lg p-4 border border-muted/40">
        <TaskFormTitle title={title} setTitle={setTitle} />
      </div>
      
      <div className="bg-muted/30 rounded-lg p-4 border border-muted/40">
        <TaskFormDescription description={description} setDescription={setDescription} />
      </div>
      
      <div className="bg-muted/30 rounded-lg p-4 border border-muted/40 space-y-4">
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
        <div className="bg-muted/30 rounded-lg p-4 border border-muted/40">
          <SimpleFileDisplay 
            files={existingFiles} 
            parentType="task"
            allowDelete
            onFileDeleted={handleFileDeleted}
            parentId={editingTask.id}
          />
        </div>
      )}
      
      <div className="bg-muted/30 rounded-lg p-4 border border-muted/40">
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
