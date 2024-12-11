import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../shared/RichTextEditor";
import { useState, useEffect, useCallback } from "react";

interface TaskFormDescriptionProps {
  description: string;
  setDescription: (description: string) => void;
}

export const TaskFormDescription = ({ description, setDescription }: TaskFormDescriptionProps) => {
  const [localDescription, setLocalDescription] = useState(description);

  // Update local state when parent description changes (e.g., when editing a task)
  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  // Memoize the onChange handler to prevent unnecessary re-renders
  const handleEditorChange = useCallback((value: string) => {
    setLocalDescription(value);
    // Debounce the parent state update to reduce re-renders
    const timeoutId = setTimeout(() => {
      setDescription(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [setDescription]);

  console.log("TaskFormDescription - Current description value:", description);
  console.log("TaskFormDescription - Current local description value:", localDescription);
  
  return (
    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <RichTextEditor
        key={description} // Add key to force re-render only when description prop changes
        content={localDescription}
        onChange={handleEditorChange}
      />
    </div>
  );
};