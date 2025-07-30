
import { Button } from "@/components/ui/button";
import { EnhancedButton } from "@/components/ui/enhanced-button";
import { EnhancedHeader } from "@/components/ui/enhanced-header";
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
    <div className="flex items-center justify-between mb-6">
      <EnhancedHeader level={2} variant="gradient">
        {editingTask ? t("tasks.editTask") : t("tasks.addTask")}
      </EnhancedHeader>
      {onAddTask && (
        <EnhancedButton 
          onClick={onAddTask} 
          variant="default"
          className="flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          {isGeorgian ? (
            <GeorgianAuthText fontWeight="bold">
              <LanguageText>{t("tasks.addTask")}</LanguageText>
            </GeorgianAuthText>
          ) : (
            <LanguageText>{t("tasks.addTask")}</LanguageText>
          )}
        </EnhancedButton>
      )}
    </div>
  );
};
