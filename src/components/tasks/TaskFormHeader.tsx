
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Task } from "@/lib/types";

interface TaskFormHeaderProps {
  onAddTask?: () => void;
  editingTask?: Task | null;
}

export const TaskFormHeader = ({ onAddTask, editingTask }: TaskFormHeaderProps) => {
  const { t } = useLanguage();
  
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-bold">
        {editingTask ? t("tasks.editTask") : t("tasks.title")}
      </h2>
      {onAddTask && (
        <Button onClick={onAddTask} className="bg-primary hover:bg-primary/90 text-white flex items-center">
          <PlusCircle className="mr-1 h-4 w-4" />
          {t("tasks.addTask")}
        </Button>
      )}
    </div>
  );
};
