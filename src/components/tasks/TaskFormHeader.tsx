
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
    <div className="sticky top-0 z-30 mb-4 pb-3 pr-10 bg-background/95 backdrop-blur-md">
      <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-3.5 sm:p-4 shadow-sm">
        <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-primary" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.07] to-transparent" />
        <h2 className="relative flex items-center gap-3 text-base sm:text-xl font-semibold tracking-tight text-foreground min-w-0">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
            <PlusCircle className="h-[18px] w-[18px] text-primary" />
          </span>
          <span className="truncate">
          {isGeorgian ? (
            <GeorgianAuthText fontWeight="bold">
              <LanguageText>{editingTask ? t("tasks.editTask") : t("tasks.addTask")}</LanguageText>
            </GeorgianAuthText>
          ) : (
            <LanguageText>{editingTask ? t("tasks.editTask") : t("tasks.addTask")}</LanguageText>
          )}
          </span>
        </h2>
      {onAddTask && (
        <Button 
          onClick={onAddTask} 
          variant="dynamic"
          className="relative font-semibold text-white flex items-center gap-1"
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
    </div>
  );
};
