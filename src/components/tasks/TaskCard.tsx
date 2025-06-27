
import { Task } from "@/lib/types";
import { Draggable } from "@hello-pangea/dnd";
import { Pencil, Trash2, Paperclip } from "lucide-react";
import { Button } from "../ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";
import { TaskDateInfo } from "./TaskDateInfo";

interface TaskCardProps {
  task: Task;
  index: number;
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
}

export const TaskCard = ({ task, index, onEdit, onView, onDelete }: TaskCardProps) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const { data: files } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id);
      return data || [];
    },
  });

  const getTaskStyle = (status: string) => {
    switch (status) {
      case 'in-progress':
        return 'border-l-4 border-l-amber-500';
      case 'done':
        return 'border-l-4 border-l-green-500';
      default:
        return 'border-l-4 border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView(task);
  };

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-4 bg-background dark:bg-gray-800 rounded-lg shadow ${getTaskStyle(task.status)}`}
        >
          <div className="flex justify-between items-start">
            <div className={task.status === 'done' ? 'line-through text-gray-500' : 'text-foreground'}>
              <div className="flex items-center gap-2">
                {isGeorgian ? (
                  <h3 
                    className="font-semibold cursor-pointer hover:text-primary transition-colors" 
                    onClick={handleTitleClick}
                  >
                    <GeorgianAuthText fontWeight="bold">{task.title}</GeorgianAuthText>
                  </h3>
                ) : (
                  <h3 
                    className="font-semibold cursor-pointer hover:text-primary transition-colors"
                    onClick={handleTitleClick}
                  >
                    {task.title}
                  </h3>
                )}
                {files && files.length > 0 && (
                  <div className="flex items-center text-gray-600">
                    <Paperclip className="h-4 w-4" />
                    <span className="text-sm ml-1">{files.length}</span>
                  </div>
                )}
              </div>
              {task.description && (
                <div 
                  className="prose dark:prose-invert max-w-none mt-2 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
              )}
              <div className="mt-2">
                <TaskDateInfo 
                  deadline={task.deadline_at} 
                  reminderAt={task.reminder_at} 
                  compact 
                />
              </div>
            </div>
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(task)}
                className="text-foreground hover:text-foreground/80 h-8 w-8"
                title="Edit task"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(task.id)}
                className="text-foreground hover:text-foreground/80 h-8 w-8"
                title="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
