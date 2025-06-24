
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
  
  const { data: existingFiles = [], refetch } = useQuery({
    queryKey: ['taskFiles', editingTask?.id],
    queryFn: async () => {
      if (!editingTask?.id) return [];
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', editingTask.id);
      
      if (error) throw error;
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

  const handleReminderChange = (newReminder: string | undefined) => {
    if (newReminder && deadline) {
      const reminderDate = new Date(newReminder);
      const deadlineDate = new Date(deadline);
      
      if (reminderDate >= deadlineDate) {
        toast({
          title: t("common.warning"),
          description: "Reminder must be before deadline",
          variant: "destructive",
        });
        return;
      }
    }
    setReminderAt(newReminder);
  };

  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";

  return (
    <div className="space-y-4">
      <TaskFormTitle title={title} setTitle={setTitle} />
      <TaskFormDescription description={description} setDescription={setDescription} />
      
      <div className="space-y-3">
        <TaskDateTimePicker
          label="Deadline"
          value={deadline}
          onChange={setDeadline}
          placeholder="Set deadline (optional)"
          minDate={new Date()}
        />
        
        <TaskDateTimePicker
          label="Reminder"
          value={reminderAt}
          onChange={handleReminderChange}
          placeholder="Set reminder (optional)"
          minDate={new Date()}
        />
      </div>
      
      {editingTask?.id && existingFiles && existingFiles.length > 0 && (
        <div className="space-y-2">
          <FileDisplay 
            files={existingFiles} 
            bucketName="event_attachments"
            allowDelete
            onFileDeleted={handleFileDeleted}
            parentId={editingTask.id}
            parentType="task"
            fallbackBuckets={["customer_attachments"]}
          />
        </div>
      )}
      <FileUploadField 
        onChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
        acceptedFileTypes={acceptedFormats}
      />
    </div>
  );
};
