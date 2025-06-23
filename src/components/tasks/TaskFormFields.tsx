
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
  deadline?: string;
  setDeadline: (deadline: string | undefined) => void;
  reminder?: string;
  setReminder: (reminder: string | undefined) => void;
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
  reminder,
  setReminder,
}: TaskFormFieldsProps) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
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
          description: t("tasks.reminderMustBeBeforeDeadline"),
          variant: "destructive",
        });
        return;
      }
    }
    setReminder(newReminder);
  };

  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";

  return (
    <div className="space-y-4">
      <TaskFormTitle title={title} setTitle={setTitle} />
      <TaskFormDescription description={description} setDescription={setDescription} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TaskDateTimePicker
          label={t("tasks.deadline")}
          value={deadline}
          onChange={setDeadline}
          placeholder={t("tasks.selectDeadline")}
          minDate={new Date()}
        />
        
        <TaskDateTimePicker
          label={t("tasks.reminder")}
          value={reminder}
          onChange={handleReminderChange}
          placeholder={t("tasks.selectReminder")}
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
