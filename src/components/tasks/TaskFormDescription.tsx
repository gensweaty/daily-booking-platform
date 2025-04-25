
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../shared/RichTextEditor";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";

interface TaskFormDescriptionProps {
  description: string;
  setDescription: (description: string) => void;
}

export const TaskFormDescription = ({ description, setDescription }: TaskFormDescriptionProps) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-2">
      <Label htmlFor="description">
        <LanguageText>{t("tasks.descriptionLabel")}</LanguageText>
      </Label>
      <RichTextEditor
        content={description}
        onChange={setDescription}
      />
    </div>
  );
};
