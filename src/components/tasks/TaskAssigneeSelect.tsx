import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTaskAssignment } from "@/hooks/useTaskAssignment";
import { Loader2 } from "lucide-react";

interface TaskAssigneeSelectProps {
  value?: string; // Format: "type:id"
  onChange: (value: string) => void;
  boardOwnerId?: string; // For public boards, pass the board owner's ID
}

export const TaskAssigneeSelect = ({ value, onChange, boardOwnerId }: TaskAssigneeSelectProps) => {
  const { assignees, isLoading } = useTaskAssignment(boardOwnerId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 py-2 border rounded-md bg-background">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading users...</span>
      </div>
    );
  }

  return (
    <Select value={value || "unassigned"} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue>
          {value && value !== "unassigned" ? (
            <div className="flex items-center gap-2">
              {(() => {
                const [type, id] = value.split(':');
                const assignee = assignees.find(a => a.id === id && a.type === type);
                return assignee ? (
                  <>
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={assignee.avatar_url} alt={assignee.name} />
                      <AvatarFallback className="text-xs">
                        {assignee.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{assignee.name}</span>
                  </>
                ) : (
                  <span>Unassigned</span>
                );
              })()}
            </div>
          ) : (
            <span>Unassigned</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-background">
        <SelectItem value="unassigned">
          <span className="text-muted-foreground">Unassigned</span>
        </SelectItem>
        {assignees.map((assignee) => (
          <SelectItem key={`${assignee.type}:${assignee.id}`} value={`${assignee.type}:${assignee.id}`}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={assignee.avatar_url} alt={assignee.name} />
                <AvatarFallback className="text-xs">
                  {assignee.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{assignee.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
