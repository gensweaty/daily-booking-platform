
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../shared/RichTextEditor";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface TaskFormDescriptionProps {
  description: string;
  setDescription: (description: string) => void;
}

export const TaskFormDescription = ({ description, setDescription }: TaskFormDescriptionProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  return (
    <div className="space-y-2 min-w-0 w-full overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-3.5 w-3.5 text-primary" />
        </span>
        <Label
          htmlFor="description"
          className={cn("text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", isGeorgian ? "font-georgian" : "")}
          style={isGeorgian ? {fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"} : undefined}
        >
          <LanguageText>{t("tasks.descriptionLabel")}</LanguageText>
        </Label>
      </div>
      <div 
        className={cn(isGeorgian ? "is-editor-empty:before:font-georgian" : "")}
        style={isGeorgian ? {fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"} : undefined}
      >
        <RichTextEditor
          content={description}
          onChange={setDescription}
          placeholder={isGeorgian ? "აღწერა..." : "Description..."}
        />
      </div>
    </div>
  );
};
