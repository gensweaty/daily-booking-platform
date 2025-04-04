
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReminders, updateReminder, deleteReminder } from "@/lib/api";
import { Reminder } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { useToast } from "./ui/use-toast";
import { ReminderNotificationManager } from "./reminder/ReminderNotificationManager";

export const ReminderList = () => {
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: getReminders,
  });

  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateReminderMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Reminder> }) =>
      updateReminder(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ 
        title: "Success",
        description: "Reminder updated successfully" 
      });
      setEditingReminder(null);
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: deleteReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ 
        title: "Success",
        description: "Reminder deleted successfully" 
      });
    },
  });

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setEditTitle(reminder.title);
    setEditDescription(reminder.description || "");
    const formattedDate = format(new Date(reminder.remind_at), "yyyy-MM-dd'T'HH:mm");
    setEditDueDate(formattedDate);
  };

  const handleSaveEdit = () => {
    if (!editingReminder) return;
    updateReminderMutation.mutate({
      id: editingReminder.id,
      updates: {
        title: editTitle,
        description: editDescription,
        remind_at: editDueDate,
      },
    });
  };

  if (isLoading) return <div>Loading reminders...</div>;

  return (
    <>
      <ReminderNotificationManager reminders={reminders} />
      <div className="space-y-4">
        {reminders?.map((reminder: Reminder) => (
          <div
            key={reminder.id}
            className="p-4 bg-white rounded-lg shadow border border-gray-200"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{reminder.title}</h3>
                {reminder.description && (
                  <p className="text-gray-600 mt-1">{reminder.description}</p>
                )}
                <div className="mt-2 text-sm text-gray-500">
                  Due: {format(parseISO(reminder.remind_at), 'PPpp')}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(reminder)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteReminderMutation.mutate(reminder.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editingReminder} onOpenChange={() => setEditingReminder(null)}>
        <DialogContent>
          <DialogTitle>Edit Reminder</DialogTitle>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Reminder title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
            <Input
              type="datetime-local"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
            />
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
