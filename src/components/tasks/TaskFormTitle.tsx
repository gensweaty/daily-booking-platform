
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";

interface TaskFormTitleProps {
  title: string;
  setTitle: (title: string) => void;
}

export const TaskFormTitle = ({ title, setTitle }: TaskFormTitleProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  return (
    <div className="space-y-2">
      <Label htmlFor="title">
        <LanguageText>{t("tasks.title")}</LanguageText>
      </Label>
      <Input
        id="title"
        placeholder={t("tasks.titlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={`bg-background border-input ${isGeorgian ? "placeholder:font-georgian" : ""}`}
      />
    </div>
  );
};
