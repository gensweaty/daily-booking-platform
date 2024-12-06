import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../shared/RichTextEditor";

interface TaskFormDescriptionProps {
  description: string;
  setDescription: (description: string) => void;
}

export const TaskFormDescription = ({ description, setDescription }: TaskFormDescriptionProps) => {
  console.log("TaskFormDescription - Current description value:", description);
  
  return (
    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <RichTextEditor
        key={description} // Add key to force re-render when description changes
        content={description}
        onChange={setDescription}
      />
    </div>
  );
};