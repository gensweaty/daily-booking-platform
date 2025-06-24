
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";

export const TaskReminderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: tasks } = useQuery({
    queryKey: ['taskReminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date();
      const oneMinuteFromNow = new Date(now.getTime() + 60000); // Check 1 minute ahead
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('reminder_at', 'is', null)
        .gte('reminder_at', now.toISOString())
        .lte('reminder_at', oneMinuteFromNow.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Check every 30 seconds
  });

  useEffect(() => {
    if (tasks && tasks.length > 0) {
      tasks.forEach((task) => {
        const reminderTime = new Date(task.reminder_at);
        const now = new Date();
        
        // Show notification if reminder time is within the next minute
        if (reminderTime.getTime() - now.getTime() <= 60000 && reminderTime.getTime() > now.getTime()) {
          toast({
            title: "Task Reminder",
            description: `Reminder: ${task.title}`,
            duration: 5000,
            action: (
              <div className="flex items-center">
                <Bell className="h-4 w-4" />
              </div>
            ),
          });
        }
      });
    }
  }, [tasks, toast]);

  return null; // This component only handles notifications, no UI
};
