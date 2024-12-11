import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../shared/RichTextEditor";
import { useEffect } from "react";

interface TaskFormDescriptionProps {
  description: string;
  setDescription: (description: string) => void;
}

export const TaskFormDescription = ({ description, setDescription }: TaskFormDescriptionProps) => {
  useEffect(() => {
    console.log("TaskFormDescription - Current description:", description);
  }, [description]);

  return (
    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <RichTextEditor
        key="task-description-editor"
        content={description}
        onChange={setDescription}
      />
    </div>
  );
};