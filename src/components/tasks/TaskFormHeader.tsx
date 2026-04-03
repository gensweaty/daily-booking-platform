
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Task } from "@/lib/types";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface TaskFormHeaderProps {
  onAddTask?: () => void;
  editingTask?: Task | null;
}

export const TaskFormHeader = ({ onAddTask, editingTask }: TaskFormHeaderProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  return (
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
      <h2 className="flex items-center gap-2.5 text-base sm:text-lg font-semibold text-foreground">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <PlusCircle className="h-4 w-4 text-primary" />
        </div>
        {isGeorgian ? (
          <GeorgianAuthText fontWeight="bold">
            <LanguageText>{editingTask ? t("tasks.editTask") : t("tasks.addTask")}</LanguageText>
          </GeorgianAuthText>
        ) : (
          <LanguageText>{editingTask ? t("tasks.editTask") : t("tasks.addTask")}</LanguageText>
        )}
      </h2>
      {onAddTask && (
        <Button 
          onClick={onAddTask} 
          variant="dynamic"
          className="font-semibold text-white flex items-center gap-1"
        >
          <PlusCircle className="h-4 w-4" />
          {isGeorgian ? (
            <GeorgianAuthText fontWeight="bold">
              <LanguageText>{t("tasks.addTask")}</LanguageText>
            </GeorgianAuthText>
          ) : (
            <LanguageText>{t("tasks.addTask")}</LanguageText>
          )}
        </Button>
      )}
    </div>
  );
};
