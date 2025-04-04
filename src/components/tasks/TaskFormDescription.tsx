
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../shared/RichTextEditor";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskFormDescriptionProps {
  description: string;
  setDescription: (description: string) => void;
}

export const TaskFormDescription = ({ description, setDescription }: TaskFormDescriptionProps) => {
  const { language } = useLanguage();

  return (
    <div className="space-y-2">
      <Label htmlFor="description">{language === 'es' ? 'Descripción' : 'Description'}</Label>
      <RichTextEditor
        content={description}
        onChange={setDescription}
      />
    </div>
  );
};
