
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Task } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export const TaskReminderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: tasks = [] } = useQuery({
    queryKey: ['taskReminders'],
    queryFn: async () => {
      if (!user) return [];
      
      const now = new Date();
      const oneMinuteFromNow = new Date(now.getTime() + 60000); // Check for reminders in the next minute
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('reminder_at', 'is', null)
        .gte('reminder_at', now.toISOString())
        .lte('reminder_at', oneMinuteFromNow.toISOString());
      
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds
  });

  useEffect(() => {
    if (tasks.length > 0) {
      tasks.forEach((task) => {
        const reminderTime = new Date(task.reminder_at!);
        const now = new Date();
        
        // If reminder time is within 1 minute, show notification
        if (reminderTime.getTime() - now.getTime() <= 60000) {
          toast({
            title: `📋 ${t("tasks.reminder")}: ${task.title}`,
            description: task.description || t("tasks.taskReminder"),
            duration: 10000, // Show for 10 seconds
          });
        }
      });
    }
  }, [tasks, toast, t]);

  return null; // This component doesn't render anything visual
};
