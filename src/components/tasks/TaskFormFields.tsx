
import { SimpleFileDisplay } from "../shared/SimpleFileDisplay";
import { AttachmentDropzone } from "../shared/AttachmentDropzone";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Task } from "@/lib/types";
import { TaskFormTitle } from "./TaskFormTitle";
import { TaskFormDescription } from "./TaskFormDescription";
import { TaskDateTimePicker } from "./TaskDateTimePicker";
import { TaskStatusSelect } from "./TaskStatusSelect";
import { TaskAssigneeSelect } from "./TaskAssigneeSelect";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimezoneValidation } from "@/hooks/useTimezoneValidation";
import { ensureNotificationPermission } from "@/utils/notificationUtils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { UserCheck, Paperclip, CalendarClock } from "lucide-react";

interface TaskFormFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
  selectedFiles: File[];
  setSelectedFiles: (files: File[]) => void;
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
  assignedTo: string;
  setAssignedTo: (value: string) => void;
  boardOwnerId?: string; // For public boards
}

export const TaskFormFields = ({
  title,
  setTitle,
  description,
  setDescription,
  selectedFiles,
  setSelectedFiles,
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
  assignedTo,
  setAssignedTo,
  boardOwnerId,
}: TaskFormFieldsProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { validateDateTime } = useTimezoneValidation();
  const isMobile = useMediaQuery("(max-width: 640px)");

  const { data: existingFiles = [], refetch } = useQuery({
    queryKey: ['taskFiles', editingTask?.id],
    queryFn: async () => {
      if (!editingTask?.id) return [];
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', editingTask.id);

      if (error) {
        console.error('Error fetching task files:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!editingTask?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
      setEmailReminder(true);

      // If editing existing task, immediately update the database to persist the setting
      if (editingTask?.id) {
        try {
          const { error } = await supabase
            .from('tasks')
            .update({
              reminder_at: newReminder,
              email_reminder_enabled: true
            })
            .eq('id', editingTask.id);

          if (error) {
            console.error('❌ Failed to update task reminder settings:', error);
          }
        } catch (error) {
          console.error('❌ Exception updating task reminder:', error);
        }
      }
    } else {
      setEmailReminder(false);
    }
  };

  const sectionClassName = isMobile
    ? "rounded-lg border border-border bg-card p-3 overflow-x-hidden min-w-0"
    : "rounded-xl border border-border bg-card p-4 lg:p-5 min-w-0";

  const containerClassName = isMobile ? "space-y-3" : "space-y-4 lg:space-y-5";

  const SectionLabel = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-2.5">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  );

  return (
    <div className={`${containerClassName} min-w-0 w-full`}>
      <div className={sectionClassName}>
        <TaskFormTitle title={title} setTitle={setTitle} />
      </div>

      <div className={sectionClassName}>
        <TaskFormDescription description={description} setDescription={setDescription} />
      </div>

      <div className={`grid gap-4 lg:gap-5 ${isMobile ? '' : 'md:grid-cols-2'}`}>
        <div className={sectionClassName}>
          <TaskStatusSelect status={status} setStatus={setStatus} />
        </div>

        <div className={sectionClassName}>
          <SectionLabel icon={UserCheck}>Assign</SectionLabel>
          <TaskAssigneeSelect
            value={assignedTo}
            onChange={setAssignedTo}
            boardOwnerId={boardOwnerId}
          />
        </div>
      </div>

      <div className={`${sectionClassName} ${isMobile ? 'space-y-2' : 'space-y-4'}`}>
        <SectionLabel icon={CalendarClock}>{t("common.schedule")}</SectionLabel>
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
          <SectionLabel icon={Paperclip}>{t("common.attachments")}</SectionLabel>
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
        <AttachmentDropzone
          files={selectedFiles}
          onFilesChange={setSelectedFiles}
          error={fileError}
          setError={setFileError}
        />
      </div>
    </div>
  );
};
