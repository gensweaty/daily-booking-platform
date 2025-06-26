
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell } from "lucide-react";

export const TaskReminderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [processedReminders, setProcessedReminders] = useState<Set<string>>(new Set());
  const forceRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Load processed reminders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("processedTaskReminders");
      if (stored) {
        const parsed = JSON.parse(stored);
        setProcessedReminders(new Set(parsed));
        console.log("Loaded processed reminders from storage:", parsed.length);
      }
    } catch (error) {
      console.error("Error loading processed reminders:", error);
    }
  }, []);

  // Save processed reminders to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("processedTaskReminders", JSON.stringify(Array.from(processedReminders)));
    } catch (error) {
      console.error("Error saving processed reminders:", error);
    }
  }, [processedReminders]);

  // Force refresh logic even when React doesn't update
  useEffect(() => {
    if (!user?.id) return;
    
    forceRefreshInterval.current = setInterval(() => {
      console.log("🔄 Force refreshing task reminders");
      queryClient.invalidateQueries({ queryKey: ['taskReminders', user.id] });
    }, 10000);

    return () => {
      if (forceRefreshInterval.current) clearInterval(forceRefreshInterval.current);
    };
  }, [user?.id, queryClient]);

  const { data: tasks } = useQuery({
    queryKey: ['taskReminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date();
      // Look for reminders that are due (past or within next 3 minutes for catch-up)
      const futureWindow = new Date(now.getTime() + 3 * 60 * 1000);
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .not('reminder_at', 'is', null)
        .lte('reminder_at', futureWindow.toISOString())
        .order('reminder_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching task reminders:', error);
        throw error;
      }
      
      console.log('Task reminders found:', data?.length || 0);
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  const playNotificationSound = () => {
    try {
      const audio = new Audio("/audio/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch((error) => {
        console.log("Could not play notification sound:", error);
      });
    } catch (error) {
      console.log("Notification sound not available:", error);
    }
  };

  const showBrowserNotification = (taskTitle: string) => {
    console.log("Attempting to show browser notification for:", taskTitle);
    
    if (Notification.permission !== "granted") {
      console.warn("⛔ Browser notifications not allowed");
      return;
    }

    try {
      // Check if service worker is available for enhanced notifications
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) {
            reg.showNotification("📋 Task Reminder", {
              body: `Reminder: ${taskTitle}`,
              icon: "/favicon.ico",
              requireInteraction: true,
              tag: `task-${taskTitle}`,
            });
            console.log("Service worker notification sent");
            playNotificationSound();
          } else {
            // Fallback to regular notification
            createRegularNotification(taskTitle);
          }
        }).catch(() => {
          // Fallback to regular notification if service worker fails
          createRegularNotification(taskTitle);
        });
      } else {
        // Fallback to regular notification
        createRegularNotification(taskTitle);
      }
    } catch (error) {
      console.error("❌ Error showing browser notification:", error);
      // Try fallback
      createRegularNotification(taskTitle);
    }
  };

  const createRegularNotification = (taskTitle: string) => {
    try {
      const notification = new Notification("📋 Task Reminder", {
        body: `Reminder: ${taskTitle}`,
        icon: "/favicon.ico",
        tag: `task-reminder-${taskTitle}`,
        requireInteraction: true,
      });

      console.log("Regular browser notification created successfully");
      playNotificationSound();

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
      console.error("❌ Error creating regular notification:", error);
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
        const reminderKey = `${task.id}-${task.reminder_at}`;
        
        // Use simpler boolean logic for due check
        const isDue = now >= reminderTime && now <= new Date(reminderTime.getTime() + 30 * 60 * 1000);
        
        console.log('Checking reminder for task:', task.title);
        console.log('Reminder time:', reminderTime.toLocaleString());
        console.log('Current time:', now.toLocaleString());
        console.log('Is due:', isDue);
        console.log('Already processed:', processedReminders.has(reminderKey));
        
        if (isDue && !processedReminders.has(reminderKey)) {
          console.log('🔔 Triggering notifications for task:', task.title);
          
          // Show both types of notifications
          showDashboardNotification(task.title);
          showBrowserNotification(task.title);
          
          // Mark this reminder as processed
          setProcessedReminders(prev => {
            const newSet = new Set([...prev, reminderKey]);
            console.log('Added to processed reminders:', reminderKey);
            console.log('Total processed reminders:', newSet.size);
            return newSet;
          });
        }
      });
    }
  }, [tasks, processedReminders]);

  // Clean up old processed reminders every hour
  useEffect(() => {
    const cleanup = setInterval(() => {
      console.log('Cleaning up old processed reminders');
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      setProcessedReminders(prev => {
        const newSet = new Set<string>();
        prev.forEach(key => {
          // Keep reminders that are less than 1 hour old
          const [, reminderTimeStr] = key.split('-');
          if (reminderTimeStr) {
            const reminderTime = new Date(reminderTimeStr);
            if (reminderTime > oneHourAgo) {
              newSet.add(key);
            }
          }
        });
        console.log('Cleaned up processed reminders. Before:', prev.size, 'After:', newSet.size);
        return newSet;
      });
    }, 60 * 60 * 1000); // Clean up every hour

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
