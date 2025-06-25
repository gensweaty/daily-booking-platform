
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
      const twoMinutesFromNow = new Date(now.getTime() + 2 * 60 * 1000); // Check 2 minutes ahead
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('reminder_at', 'is', null)
        .gte('reminder_at', now.toISOString())
        .lte('reminder_at', twoMinutesFromNow.toISOString());
      
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
        
        // Show notification if reminder time is within the next minute and hasn't been processed yet
        if (timeDiff <= 60000 && timeDiff > -60000) { // 1 minute window
          const reminderKey = `${task.id}-${task.reminder_at}`;
          
          if (!processedReminders.has(reminderKey)) {
            console.log('Showing reminder notifications for task:', task.title);
            console.log('Time difference:', timeDiff, 'ms');
            
            // Show dashboard notification
            showDashboardNotification(task.title);
            
            // Show browser notification
            showBrowserNotification(task.title);
            
            // Mark this reminder as processed
            setProcessedReminders(prev => new Set([...prev, reminderKey]));
          }
        }
      });
    }
  }, [tasks, notificationPermission, processedReminders]);

  // Clean up old processed reminders (older than 1 hour)
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // This is a simple cleanup - in a real app you might want to store timestamps
      // For now, we'll just clear the set periodically
      if (processedReminders.size > 100) {
        setProcessedReminders(new Set());
      }
    }, 60 * 60 * 1000); // Clean up every hour

    return () => clearInterval(cleanup);
  }, [processedReminders.size]);

  return null; // This component only handles notifications, no UI
};
