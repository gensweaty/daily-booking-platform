
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { cn } from "@/lib/utils";

interface TaskFormTitleProps {
  title: string;
  setTitle: (title: string) => void;
}

export const TaskFormTitle = ({ title, setTitle }: TaskFormTitleProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  console.log("TaskFormTitle rendering with title:", title, "language:", language);

  return (
    <div className="space-y-2">
      <Label 
        htmlFor="title"
        className={cn(isGeorgian ? "font-georgian" : "")}
        style={isGeorgian ? {fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"} : undefined}
      >
        <LanguageText>{t("tasks.title")}</LanguageText>
      </Label>
      <Input
        id="title"
        placeholder={t("tasks.titlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={cn("bg-background border-input", isGeorgian ? "placeholder:font-georgian" : "")}
        style={isGeorgian ? {fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"} : undefined}
      />
    </div>
  );
};
