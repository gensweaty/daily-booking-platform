
import { DialogTitle } from "@/components/ui/dialog";
import { Task } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskFormHeaderProps {
  editingTask: Task | null;
}

export const TaskFormHeader = ({ editingTask }: TaskFormHeaderProps) => {
  const { t } = useLanguage();
  
  return (
    <DialogTitle className="text-foreground">
      {editingTask ? t("tasks.editTask") : t("tasks.addNewTask")}
    </DialogTitle>
  );
};
