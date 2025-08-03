
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AddTaskForm from "@/components/AddTaskForm";

export const TaskCreate = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="mb-4">
        <Plus className="w-4 h-4 mr-2" />
        Add Task
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <AddTaskForm onClose={() => setIsOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};
