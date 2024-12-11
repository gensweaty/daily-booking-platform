import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../shared/RichTextEditor";
import { useState, useEffect } from "react";

interface TaskFormDescriptionProps {
  description: string;
  setDescription: (description: string) => void;
}

export const TaskFormDescription = ({ description, setDescription }: TaskFormDescriptionProps) => {
  const [localDescription, setLocalDescription] = useState(description);

  useEffect(() => {
    if (description !== localDescription) {
      console.log("Parent description changed:", description);
      setLocalDescription(description);
    }
  }, [description, localDescription]);

  const handleBlur = () => {
    console.log("Editor blur - updating parent with:", localDescription);
    setDescription(localDescription);
  };

  const handleChange = (value: string) => {
    console.log("Local description update:", value);
    setLocalDescription(value);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <RichTextEditor
        content={localDescription}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  );
};