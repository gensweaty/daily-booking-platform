
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

export const TaskReminderNotifications = () => {
  const { toast } = useToast();
  
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  });

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      
      tasks.forEach((task) => {
        if (task.reminder_at) {
          const reminderTime = new Date(task.reminder_at);
          const timeDiff = reminderTime.getTime() - now.getTime();
          
          // Show reminder if it's due within the next minute
          if (timeDiff > 0 && timeDiff <= 60000) {
            toast({
              title: "Task Reminder",
              description: `Reminder: ${task.title}`,
              duration: 10000, // Show for 10 seconds
            });
          }
        }
      });
    };

    // Check reminders every minute
    const interval = setInterval(checkReminders, 60000);
    
    // Check immediately
    checkReminders();

    return () => clearInterval(interval);
  }, [tasks, toast]);

  return null; // This component doesn't render anything
};
