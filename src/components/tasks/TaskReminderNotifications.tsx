
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell } from "lucide-react";

export const TaskReminderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [processedReminders, setProcessedReminders] = useState<Set<string>>(new Set());

  // Request notification permission on component mount
  useEffect(() => {
    if ("Notification" in window) {
      console.log("Browser supports notifications");
      setNotificationPermission(Notification.permission);
      
      if (Notification.permission === "default") {
        console.log("Requesting notification permission...");
        Notification.requestPermission().then((permission) => {
          console.log("Permission result:", permission);
          setNotificationPermission(permission);
        });
      }
    } else {
      console.log("Browser does not support notifications");
    }
  }, []);

  const { data: tasks } = useQuery({
    queryKey: ['taskReminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date();
      const threeMinutesFromNow = new Date(now.getTime() + 3 * 60 * 1000);
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('reminder_at', 'is', null)
        .gte('reminder_at', now.toISOString())
        .lte('reminder_at', threeMinutesFromNow.toISOString())
        .order('reminder_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching task reminders:', error);
        throw error;
      }
      
      console.log('Task reminders found:', data);
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 15000, // Check every 15 seconds for better accuracy
  });

  const showBrowserNotification = (taskTitle: string) => {
    console.log("Attempting to show browser notification for:", taskTitle);
    console.log("Notification permission:", notificationPermission);
    
    if ("Notification" in window && notificationPermission === "granted") {
      try {
        const notification = new Notification("📋 Task Reminder", {
          body: `Reminder: ${taskTitle}`,
          icon: "/favicon.ico",
          tag: `task-reminder-${taskTitle}`,
          requireInteraction: true,
        });

        console.log("Browser notification created successfully");

        // Auto-close after 10 seconds
        setTimeout(() => {
          notification.close();
        }, 10000);

        notification.onclick = () => {
          console.log("Notification clicked");
          window.focus();
          notification.close();
        };

        notification.onerror = (error) => {
          console.error("Notification error:", error);
        };

      } catch (error) {
        console.error("Error creating browser notification:", error);
      }
    } else {
      console.log("Cannot show browser notification - permission:", notificationPermission);
    }
  };

  const showDashboardNotification = (taskTitle: string) => {
    console.log("Showing dashboard notification for:", taskTitle);
    toast({
      title: "📋 Task Reminder",
      description: `Reminder: ${taskTitle}`,
      duration: 8000,
      action: (
        <div className="flex items-center">
          <Bell className="h-4 w-4" />
        </div>
      ),
    });
  };

  useEffect(() => {
    if (tasks && tasks.length > 0) {
      const now = new Date();
      
      tasks.forEach((task) => {
        const reminderTime = new Date(task.reminder_at);
        const timeDiff = reminderTime.getTime() - now.getTime();
        
        // Show notification if reminder time is within the next 3 minutes or up to 1 minute past
        if (timeDiff <= 3 * 60 * 1000 && timeDiff >= -60 * 1000) {
          const reminderKey = `${task.id}-${task.reminder_at}`;
          
          console.log('Checking reminder for task:', task.title);
          console.log('Time difference:', Math.round(timeDiff / 1000), 'seconds');
          console.log('Reminder key:', reminderKey);
          console.log('Already processed:', processedReminders.has(reminderKey));
          
          if (!processedReminders.has(reminderKey)) {
            console.log('Triggering notifications for task:', task.title);
            
            // Show dashboard notification
            showDashboardNotification(task.title);
            
            // Show browser notification
            showBrowserNotification(task.title);
            
            // Mark this reminder as processed
            setProcessedReminders(prev => {
              const newSet = new Set([...prev, reminderKey]);
              console.log('Added to processed reminders:', reminderKey);
              return newSet;
            });
          }
        }
      });
    }
  }, [tasks, notificationPermission]);

  // Clean up old processed reminders every 30 minutes
  useEffect(() => {
    const cleanup = setInterval(() => {
      console.log('Cleaning up processed reminders');
      setProcessedReminders(new Set());
    }, 30 * 60 * 1000); // Clean up every 30 minutes

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
