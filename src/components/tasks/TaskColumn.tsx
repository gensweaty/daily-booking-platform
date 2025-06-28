
import { Task } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { useLanguage } from "@/contexts/LanguageContext";

interface TaskColumnProps {
  status: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
}

export const TaskColumn = ({ status, tasks, onEdit, onView, onDelete, onArchive }: TaskColumnProps) => {
  const { t } = useLanguage();
  
  const getColumnTitle = (status: string) => {
    switch (status) {
      case 'todo':
        return t("tasks.todo");
      case 'in-progress':
        return t("tasks.inProgress");
      case 'done':
        return t("tasks.done");
      default:
        return status;
    }
  };

  return (
    <Droppable droppableId={status}>
      {(provided, snapshot) => (
        <div
          {...provided.droppableProps}
          ref={provided.innerRef}
          className={`bg-muted/30 p-4 rounded-lg min-h-[200px] ${
            snapshot.isDraggingOver ? 'bg-muted/50' : ''
          }`}
        >
          <h3 className="font-semibold mb-4 text-foreground">
            {getColumnTitle(status)} ({tasks.length})
          </h3>
          
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={snapshot.isDragging ? 'opacity-50' : ''}
                  >
                    <TaskCard
                      task={task}
                      onEdit={onEdit}
                      onView={onView}
                      onDelete={onDelete}
                      onArchive={onArchive}
                    />
                  </div>
                )}
              </Draggable>
            ))}
          </div>
          
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
};
