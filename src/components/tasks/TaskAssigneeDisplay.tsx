import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Task } from "@/lib/types";

interface TaskAssigneeDisplayProps {
  task: Task;
  size?: 'sm' | 'md' | 'lg';
}

export const TaskAssigneeDisplay = ({ task, size = 'md' }: TaskAssigneeDisplayProps) => {
  if (!task.assigned_to_id || !task.assigned_to_name) {
    return null;
  }

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base'
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className={sizeClasses[size]}>
            <AvatarImage src={task.assigned_to_avatar_url} alt={task.assigned_to_name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {task.assigned_to_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Assigned to: {task.assigned_to_name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
