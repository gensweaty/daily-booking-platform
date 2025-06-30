
import { FileUploadField } from "../shared/FileUploadField";
import { FileDisplay } from "../shared/FileDisplay";
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
}: TaskFormFieldsProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { validateDateTime } = useTimezoneValidation();
  
  console.log('📋 TaskFormFields - Component rendered with editingTask:', editingTask?.id);
  
  const { data: existingFiles = [], refetch } = useQuery({
    queryKey: ['taskFiles', editingTask?.id],
    queryFn: async () => {
      if (!editingTask?.id) {
        console.log('📋 TaskFormFields - No task ID, returning empty array');
        return [];
      }
      
      console.log('📋 TaskFormFields - Fetching files for task:', editingTask.id);
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', editingTask.id);
      
      if (error) {
        console.error('❌ TaskFormFields - Error fetching task files:', error);
        throw error;
      }
      
      console.log('✅ TaskFormFields - Task files loaded:', data?.length || 0, 'files');
      return data || [];
    },
    enabled: !!editingTask?.id,
  });

  const handleFileDeleted = () => {
    console.log('🗑️ TaskFormFields - File deleted, refetching task files');
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
  };

  const handleFileSelect = (file: File | null) => {
    console.log('📁 TaskFormFields - File selected:', file?.name);
    setSelectedFile(file);
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
        />
      </div>
      
      {editingTask?.id && existingFiles && existingFiles.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-4 border border-muted/40">
          <h4 className="text-sm font-medium mb-3">Existing Files</h4>
          <FileDisplay 
            files={existingFiles} 
            bucketName="event_attachments"
            allowDelete
            onFileDeleted={handleFileDeleted}
            parentId={editingTask.id}
            parentType="task"
          />
        </div>
      )}
      
      <div className="bg-muted/30 rounded-lg p-4 border border-muted/40">
        <FileUploadField 
          onChange={handleFileSelect}
          fileError={fileError}
          setFileError={setFileError}
          acceptedFileTypes={acceptedFormats}
          selectedFile={selectedFile}
        />
      </div>
    </div>
  );
};
