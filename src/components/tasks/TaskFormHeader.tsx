
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskFormHeaderProps {
  onAddTask: () => void;
}

export const TaskFormHeader = ({ onAddTask }: TaskFormHeaderProps) => {
  const { t } = useLanguage();
  
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-bold">{t("tasks.title")}</h2>
      <Button onClick={onAddTask} className="bg-primary hover:bg-primary/90 text-white flex items-center">
        <PlusCircle className="mr-1 h-4 w-4" />
        {t("tasks.addTask")}
      </Button>
    </div>
  );
};
