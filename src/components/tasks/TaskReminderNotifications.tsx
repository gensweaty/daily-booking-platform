
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
          if (permission === "granted") {
            console.log("Notification permission granted");
          } else {
            console.log("Notification permission denied");
          }
        });
      } else {
        console.log("Current notification permission:", Notification.permission);
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
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000); // Check 5 minutes ahead for better coverage
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('reminder_at', 'is', null)
        .gte('reminder_at', now.toISOString())
        .lte('reminder_at', fiveMinutesFromNow.toISOString())
        .order('reminder_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching task reminders:', error);
        throw error;
      }
      
      console.log('Task reminders found:', data);
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Check every 30 seconds for better accuracy
  });

  const showBrowserNotification = (taskTitle: string) => {
    console.log("Attempting to show browser notification for:", taskTitle);
    console.log("Notification permission:", notificationPermission);
    
    if ("Notification" in window && notificationPermission === "granted") {
      try {
        const notification = new Notification("📋 Task Reminder", {
          body: `Reminder: ${taskTitle}`,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: `task-reminder-${taskTitle}`, // Prevent duplicate notifications
          requireInteraction: true, // Keep notification visible until user interacts
        });

        console.log("Browser notification created successfully");

        // Auto-close after 10 seconds
        setTimeout(() => {
          notification.close();
        }, 10000);

        // Handle notification click
        notification.onclick = () => {
          console.log("Notification clicked");
          window.focus();
          notification.close();
        };

        // Handle notification error
        notification.onerror = (error) => {
          console.error("Notification error:", error);
        };

        // Handle notification show
        notification.onshow = () => {
          console.log("Notification shown successfully");
        };

      } catch (error) {
        console.error("Error creating browser notification:", error);
      }
    } else {
      console.log("Cannot show browser notification:", {
        hasNotificationAPI: "Notification" in window,
        permission: notificationPermission
      });
    }
  };

  const showDashboardNotification = (taskTitle: string) => {
    console.log("Showing dashboard notification for:", taskTitle);
    toast({
      title: "📋 Task Reminder",
      description: `Reminder: ${taskTitle}`,
      duration: 10000, // Show for 10 seconds
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
        
        // Show notification if reminder time is within the next 2 minutes and hasn't been processed yet
        // Using 2 minutes window to ensure we don't miss reminders due to timing
        if (timeDiff <= 2 * 60 * 1000 && timeDiff > -30 * 1000) { // 2 minutes ahead, 30 seconds past
          const reminderKey = `${task.id}-${task.reminder_at}`;
          
          console.log('Checking reminder for task:', task.title, 'Time diff:', timeDiff, 'ms');
          console.log('Processed reminders:', Array.from(processedReminders));
          console.log('Current reminder key:', reminderKey);
          
          if (!processedReminders.has(reminderKey)) {
            console.log('Showing reminder notifications for task:', task.title);
            console.log('Time difference:', timeDiff, 'ms');
            
            // Show dashboard notification
            showDashboardNotification(task.title);
            
            // Show browser notification
            showBrowserNotification(task.title);
            
            // Mark this reminder as processed
            setProcessedReminders(prev => {
              const newSet = new Set([...prev, reminderKey]);
              console.log('Updated processed reminders:', Array.from(newSet));
              return newSet;
            });
          } else {
            console.log('Reminder already processed for task:', task.title);
          }
        } else {
          console.log('Reminder not in time window for task:', task.title, 'Time diff:', timeDiff, 'ms');
        }
      });
    }
  }, [tasks, notificationPermission, processedReminders]);

  // Clean up old processed reminders (older than 1 hour)
  useEffect(() => {
    const cleanup = setInterval(() => {
      console.log('Running reminder cleanup, current size:', processedReminders.size);
      
      // Clear processed reminders every hour to prevent memory buildup
      if (processedReminders.size > 0) {
        setProcessedReminders(new Set());
        console.log('Cleared processed reminders');
      }
    }, 60 * 60 * 1000); // Clean up every hour

    return () => clearInterval(cleanup);
  }, [processedReminders.size]);

  return null; // This component only handles notifications, no UI
};
