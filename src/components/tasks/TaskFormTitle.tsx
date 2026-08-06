
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { cn } from "@/lib/utils";
import { Type } from "lucide-react";

interface TaskFormTitleProps {
  title: string;
  setTitle: (title: string) => void;
}

export const TaskFormTitle = ({ title, setTitle }: TaskFormTitleProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  return (
    <div className="space-y-2 min-w-0 w-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
          <Type className="h-3.5 w-3.5 text-primary" />
        </span>
        <Label
          htmlFor="title"
          className={cn("text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", isGeorgian ? "font-georgian" : "")}
          style={isGeorgian ? {fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"} : undefined}
        >
          <LanguageText>{t("tasks.title")}</LanguageText>
        </Label>
      </div>
      <Input
        data-tutorial="task-title-input"
        id="title"
        placeholder={t("tasks.titlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={cn("bg-background/60 border-border/60 rounded-xl min-w-0 w-full h-12 text-base font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30", isGeorgian ? "placeholder:font-georgian" : "")}
        style={isGeorgian ? {fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"} : undefined}
      />
    </div>
  );
};
