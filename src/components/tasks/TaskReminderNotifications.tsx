
import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Task } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export const useTaskReminderNotifications = (tasks: Task[]) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const notifiedTasks = useRef<Set<string>>(new Set());

  useEffect(() => {
    audioRef.current = new Audio('/audio/notification.mp3');
    audioRef.current.volume = 0.5;

    if ('Notification' in window) {
      Notification.requestPermission();
    }

    const checkTaskReminders = () => {
      tasks?.forEach((task: Task) => {
        if (!task.reminder_at) return;
        
        const reminderTime = new Date(task.reminder_at).getTime();
        const now = new Date().getTime();
        const timeDiff = reminderTime - now;

        // Check if reminder is due (within 1 minute of the reminder time)
        if (Math.abs(timeDiff) < 60000 && !notifiedTasks.current.has(task.id)) {
          notifiedTasks.current.add(task.id);
          
          if (Notification.permission === "granted") {
            audioRef.current?.play().catch(console.error);
            
            new Notification("Task Reminder", {
              body: `Reminder: ${task.title}`,
              icon: "/favicon.ico",
            });
          }
          
          toast({
            title: "⏰ Task Reminder",
            description: `Reminder: ${task.title}`,
            variant: "default",
          });
        }
      });
    };

    const interval = setInterval(checkTaskReminders, 30000); // Check every 30 seconds
    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [tasks, toast, t]);
};

export const TaskReminderNotificationManager = ({ tasks }: { tasks: Task[] }) => {
  useTaskReminderNotifications(tasks);
  return null;
};
