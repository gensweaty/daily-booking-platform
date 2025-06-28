
import { Task } from "@/lib/types";
import { Droppable } from "@hello-pangea/dnd";
import { TaskCard } from "./TaskCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";

interface TaskColumnProps {
  status: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
}

export const TaskColumn = ({ status, tasks, onEdit, onView, onDelete }: TaskColumnProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
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
    switch (status) {
      case 'todo':
        return t('tasks.todo');
      case 'in-progress':
        return t('tasks.inProgress');
      case 'done':
        return t('tasks.done');
      default:
        return status;
    }
  };

  return (
    <Droppable droppableId={status}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`p-4 rounded-lg min-h-[200px] border ${getColumnStyle(status)} flex flex-col`}
        >
          <h3 className="font-semibold mb-4 capitalize text-foreground flex-shrink-0">
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="bold">
                <LanguageText>{getColumnTitle(status)}</LanguageText>
              </GeorgianAuthText>
            ) : (
              <LanguageText>{getColumnTitle(status)}</LanguageText>
            )}
          </h3>
          <div className="space-y-4 flex-1">
            {tasks.map((task: Task, index: number) => (
              <div key={task.id} className="w-full">
                <TaskCard
                  task={task}
                  index={index}
                  onEdit={onEdit}
                  onView={onView}
                  onDelete={onDelete}
                />
              </div>
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
};
