import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TaskFormTitleProps {
  title: string;
  setTitle: (title: string) => void;
}

export const TaskFormTitle = ({ title, setTitle }: TaskFormTitleProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="title">Title</Label>
      <Input
        id="title"
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="bg-background border-input"
      />
    </div>
  );
};