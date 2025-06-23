
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Calendar, Clock, X } from "lucide-react";
import { format } from "date-fns";

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
  deadline?: Date;
  setDeadline: (deadline: Date | undefined) => void;
  reminder?: Date;
  setReminder: (reminder: Date | undefined) => void;
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
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(!!deadline);
  const [showReminderPicker, setShowReminderPicker] = useState(!!reminder);
  
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
      title: "Success",
      description: "File deleted successfully",
    });
  };

  const handleDeadlineChange = (date: Date | undefined) => {
    setDeadline(date);
    if (reminder && date && reminder > date) {
      toast({
        title: "Warning",
        description: "Reminder must be before deadline",
        variant: "destructive",
      });
    }
  };

  const handleReminderChange = (date: Date | undefined) => {
    if (deadline && date && date > deadline) {
      toast({
        title: "Warning",
        description: "Reminder must be before deadline",
        variant: "destructive",
      });
      return;
    }
    setReminder(date);
  };

  const acceptedFormats = ".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt";

  return (
    <div className="space-y-4">
      <TaskFormTitle title={title} setTitle={setTitle} />
      <TaskFormDescription description={description} setDescription={setDescription} />
      
      {/* Deadline Section */}
      <div className="space-y-2">
        {!showDeadlinePicker ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDeadlinePicker(true)}
            className="w-full justify-start"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Add Deadline
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Deadline</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDeadlinePicker(false);
                  setDeadline(undefined);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <TaskDateTimePicker
              value={deadline}
              onChange={handleDeadlineChange}
              placeholder="Select deadline"
            />
            {deadline && (
              <p className="text-sm text-muted-foreground">
                Deadline: {format(deadline, "PPP 'at' HH:mm")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Reminder Section */}
      <div className="space-y-2">
        {!showReminderPicker ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowReminderPicker(true)}
            className="w-full justify-start"
          >
            <Clock className="mr-2 h-4 w-4" />
            Add Reminder
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Reminder</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReminderPicker(false);
                  setReminder(undefined);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <TaskDateTimePicker
              value={reminder}
              onChange={handleReminderChange}
              placeholder="Select reminder time"
            />
            {reminder && (
              <p className="text-sm text-muted-foreground">
                Reminder: {format(reminder, "PPP 'at' HH:mm")}
              </p>
            )}
          </div>
        )}
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
