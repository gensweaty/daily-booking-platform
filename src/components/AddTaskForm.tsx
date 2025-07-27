
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { TaskFormFields } from "./tasks/TaskFormFields";
import { TaskFormHeader } from "./tasks/TaskFormHeader";
import { getUserTimezone } from "@/utils/timezoneUtils";

export default function AddTaskForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [deadline, setDeadline] = useState<string | undefined>(undefined);
  const [reminderAt, setReminderAt] = useState<string | undefined>(undefined);
  const [emailReminder, setEmailReminder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
      // Get user's timezone
      const userTimezone = getUserTimezone();
      
      // Create task with timezone
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          user_id: user.id,
          deadline_at: deadline || null,
          reminder_at: reminderAt || null,
          email_reminder_enabled: emailReminder,
          timezone: userTimezone,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Handle file upload if there's a selected file
      if (selectedFile && task) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${task.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("task_attachments")
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.error("File upload error:", uploadError);
          toast({
            title: t("common.warning"),
            description: t("common.fileUploadError"),
            variant: "destructive",
          });
        } else {
          // Create file record
          const { error: fileRecordError } = await supabase
            .from("files")
            .insert({
              filename: selectedFile.name,
              file_path: fileName,
              content_type: selectedFile.type,
              size: selectedFile.size,
              user_id: user.id,
              task_id: task.id,
            });

          if (fileRecordError) {
            console.error("File record error:", fileRecordError);
          }
        }
      }

      toast({
        title: t("common.success"),
        description: t("tasks.taskAdded"),
      });

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      setFileError("");
      setDeadline(undefined);
      setReminderAt(undefined);
      setEmailReminder(false);

    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: t("common.error"),
        description: t("common.somethingWentWrong"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <TaskFormHeader />
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <TaskFormFields
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            editingTask={null}
            deadline={deadline}
            setDeadline={setDeadline}
            reminderAt={reminderAt}
            setReminderAt={setReminderAt}
            emailReminder={emailReminder}
            setEmailReminder={setEmailReminder}
          />
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("common.adding") : t("tasks.addTask")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
