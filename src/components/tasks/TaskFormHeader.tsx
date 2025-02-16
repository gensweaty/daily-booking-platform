
import { DialogTitle } from "@/components/ui/dialog";
import { Task } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskFormHeaderProps {
  editingTask: Task | null;
}

export const TaskFormHeader = ({ editingTask }: TaskFormHeaderProps) => {
  const { language } = useLanguage();
  
  const getTitle = () => {
    if (language === 'es') {
      return editingTask ? 'Editar Tarea' : 'Agregar Nueva Tarea';
    }
    return editingTask ? 'Edit Task' : 'Add New Task';
  };

  return (
    <DialogTitle className="text-foreground">
      {getTitle()}
    </DialogTitle>
  );
};
