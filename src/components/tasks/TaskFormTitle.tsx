
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskFormTitleProps {
  title: string;
  setTitle: (title: string) => void;
}

export const TaskFormTitle = ({ title, setTitle }: TaskFormTitleProps) => {
  const { language } = useLanguage();

  return (
    <div className="space-y-2">
      <Label htmlFor="title">{language === 'es' ? 'Título' : 'Title'}</Label>
      <Input
        id="title"
        placeholder={language === 'es' ? 'Título de la tarea' : 'Task title'}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="bg-background border-input"
      />
    </div>
  );
};
