
import { Task } from "@/lib/types";
import { Droppable } from "@hello-pangea/dnd";
import { TaskCard } from "./TaskCard";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskColumnProps {
  status: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
}

export const TaskColumn = ({ status, tasks, onEdit, onView, onDelete }: TaskColumnProps) => {
  const { language } = useLanguage();
  
  const getColumnStyle = (status: string) => {
    switch (status) {
      case 'in-progress':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
      case 'done':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
    }
  };

  const getColumnTitle = (status: string) => {
    if (language === 'es') {
      switch (status) {
        case 'todo':
          return 'Pendiente';
        case 'in-progress':
          return 'En Progreso';
        case 'done':
          return 'Completado';
        default:
          return status;
      }
    }
    return status.replace('-', ' ');
  };

  return (
    <Droppable droppableId={status}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`p-4 rounded-lg min-h-[200px] border ${getColumnStyle(status)}`}
        >
          <h3 className="font-semibold mb-4 capitalize text-foreground">
            {getColumnTitle(status)}
          </h3>
          <div className="space-y-4">
            {tasks.map((task: Task, index: number) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
};
