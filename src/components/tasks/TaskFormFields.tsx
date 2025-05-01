
import { FileUploadField } from "../shared/FileUploadField";
import { FileDisplay } from "../shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Task } from "@/lib/types";
import { TaskFormTitle } from "./TaskFormTitle";
import { TaskFormDescription } from "./TaskFormDescription";
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
}: TaskFormFieldsProps) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const { data: existingFiles = [], refetch } = useQuery({
    queryKey: ['taskFiles', editingTask?.id],
    queryFn: async () => {
      if (!editingTask?.id) return [];
      const { data, error } = await supabase
        .from('files')  // Task files are stored in the 'files' table
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

  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";

  return (
    <div className="space-y-4">
      <TaskFormTitle title={title} setTitle={setTitle} />
      <TaskFormDescription description={description} setDescription={setDescription} />
      
      {editingTask?.id && existingFiles && existingFiles.length > 0 && (
        <div className="space-y-2">
          <FileDisplay 
            files={existingFiles} 
            bucketName="task_attachments"
            allowDelete
            onFileDeleted={handleFileDeleted}
            parentId={editingTask.id}
            parentType="task"
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
