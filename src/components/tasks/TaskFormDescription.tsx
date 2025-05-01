
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../shared/RichTextEditor";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { cn } from "@/lib/utils";

interface TaskFormDescriptionProps {
  description: string;
  setDescription: (description: string) => void;
}

export const TaskFormDescription = ({ description, setDescription }: TaskFormDescriptionProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  return (
    <div className="space-y-2">
      <Label htmlFor="description" className={cn(isGeorgian ? "font-georgian" : "")}>
        <LanguageText>{t("tasks.descriptionLabel")}</LanguageText>
      </Label>
      <div className={cn(isGeorgian ? "is-editor-empty:before:font-georgian" : "")}>
        <RichTextEditor
          content={description}
          onChange={setDescription}
          placeholder={isGeorgian ? "აღწერა..." : "Description..."}
        />
      </div>
    </div>
  );
};
