
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createReminder } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { ensureNotificationPermission, getPermissionInstructions, getDeviceSpecificMessage } from "@/utils/notificationUtils";
import { detectDevice } from "@/utils/deviceDetector";

export const AddReminderForm = ({ onClose }: { onClose: () => void }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You need to be logged in to create reminders",
        variant: "destructive",
      });
      return;
    }

    // Request notification permission when creating a reminder with due date
    if (dueDate) {
      const device = detectDevice();
      console.log(`🔔 Requesting notification permission for reminder creation on ${device.os}`);
      
      const permissionGranted = await ensureNotificationPermission();
      
      if (permissionGranted) {
        toast({
          title: "🔔 Notifications Enabled",
          description: `Perfect! You'll receive reminder notifications on your ${device.os} device`,
          duration: 4000,
        });
      } else if (Notification.permission === "denied") {
        const instructions = getPermissionInstructions();
        toast({
          title: "⚠️ Notifications Blocked",
          description: instructions,
          variant: "destructive",
          duration: 8000,
        });
      } else {
        // Permission request was cancelled or failed
        const deviceMessage = getDeviceSpecificMessage();
        toast({
          title: "🔔 Enable Notifications",
          description: deviceMessage,
          duration: 5000,
        });
      }
    }
    
    try {
      // Create reminder without send_email_reminder field
      await createReminder({ 
        title, 
        description, 
        remind_at: dueDate,
        user_id: user.id,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      await queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({
        title: "Success",
        description: "Reminder created successfully",
      });
      onClose();
    } catch (error) {
      console.error('Reminder creation error:', error);
      toast({
        title: "Error",
        description: "Failed to create reminder. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DialogTitle>Add New Reminder</DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <Input
            placeholder="Reminder title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <Input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
        <Button type="submit">Add Reminder</Button>
      </form>
    </>
  );
};
