
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Task } from "@/lib/types";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface TaskFormHeaderProps {
  onAddTask?: () => void;
  editingTask?: Task | null;
  titleKey?: string;
}

export const TaskFormHeader = ({ onAddTask, editingTask, titleKey }: TaskFormHeaderProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  // Determine what title to show - use titleKey if provided, otherwise determine based on editingTask
  const title = titleKey ? t(titleKey) : (editingTask ? t("tasks.editTask") : t("tasks.addTask"));
  
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-bold">
        {isGeorgian ? (
          <GeorgianAuthText fontWeight="bold">
            <LanguageText>{title}</LanguageText>
          </GeorgianAuthText>
        ) : (
          <LanguageText>{title}</LanguageText>
        )}
      </h2>
      {onAddTask && (
        <Button 
          onClick={onAddTask} 
          className="bg-primary hover:bg-primary/90 text-white flex items-center"
        >
          <PlusCircle className="mr-1 h-4 w-4" />
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
