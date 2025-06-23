
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye } from "lucide-react";
import { Task } from "@/lib/types";
import { Draggable } from "@hello-pangea/dnd";
import { TaskDateInfo } from "./TaskDateInfo";

interface TaskCardProps {
  task: Task;
  index: number;
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
}

export const TaskCard = ({ task, index, onEdit, onView, onDelete }: TaskCardProps) => {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 cursor-move transition-shadow ${
            snapshot.isDragging ? "shadow-lg" : ""
          } bg-card border-border hover:shadow-md`}
        >
          <CardContent className="p-3">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-sm text-foreground line-clamp-2">
                {task.title}
              </h4>
              <div className="flex gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(task);
                  }}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                  }}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {task.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                {task.description}
              </p>
            )}
            
            <TaskDateInfo 
              deadline={task.deadline_at}
              reminder={task.reminder_at}
              compact
            />
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
};
