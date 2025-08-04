import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell } from "lucide-react";
import { platformNotificationManager } from "@/utils/platformNotificationManager";

export const EventReminderNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [processedReminders, setProcessedReminders] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Load processed reminders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("processedEventReminders");
      if (stored) {
        const parsed = JSON.parse(stored);
        setProcessedReminders(new Set(parsed));
        console.log("📅 Loaded processed event reminders from storage:", parsed.length);
      }
    } catch (error) {
      console.error("❌ Error loading processed event reminders:", error);
    }
  }, []);

  // Save processed reminders to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("processedEventReminders", JSON.stringify(Array.from(processedReminders)));
    } catch (error) {
      console.error("❌ Error saving processed event reminders:", error);
    }
  }, [processedReminders]);

  // Fetch events with reminders
  const { data: events } = useQuery({
    queryKey: ['eventReminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date();
      const futureWindow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .not('reminder_at', 'is', null)
        .lte('reminder_at', futureWindow.toISOString())
        .order('reminder_at', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching event reminders:', error);
        throw error;
      }
      
      console.log('📋 Event reminders fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Show dashboard notification
  const showDashboardNotification = (eventTitle: string) => {
    console.log("📊 Showing dashboard notification for:", eventTitle);
    toast({
      title: "📋 Event Reminder",
      description: `${t('events.eventReminder')}: ${eventTitle}`,
      duration: 8000,
      action: (
        <div className="flex items-center">
          <Bell className="h-4 w-4" />
        </div>
      ),
    });
  };

  // CRITICAL FIX: Proper request body construction with validation
  const sendEmailReminder = async (event: any) => {
    try {
      console.log("📧 Starting email reminder process for event:", {
        eventId: event.id,
        title: event.title,
        userSurname: event.user_surname
      });
      
      // CRITICAL: Validate eventId before sending
      if (!event.id) {
        console.error("❌ No event ID found:", event);
        toast({
          title: "Email Error",
          description: "Invalid event - cannot send reminder",
          variant: "destructive",
        });
        return false;
      }

      const eventId = String(event.id);
      console.log("📤 Sending email with eventId:", eventId);
      
      // CRITICAL FIX: Use invoke with properly structured body
      const { data, error } = await supabase.functions.invoke('send-event-reminder-email', {
        body: { eventId: eventId }
      });

      console.log("📧 Edge function response:", { data, error });

      if (error) {
        console.error("❌ Error sending event email reminder:", error);
        toast({
          title: "Email Error",
          description: `Failed to send event email reminder: ${error.message}`,
          variant: "destructive",
        });
        return false;
      }

      console.log("✅ Event email reminder sent successfully:", data);
      
      toast({
        title: t("common.success"),
        description: t("events.reminderEmailSent"),
        duration: 3000,
      });
      
      return true;
    } catch (error) {
      console.error("❌ Failed to send event email reminder:", error);
      toast({
        title: "Email Error",
        description: "Failed to send event email reminder",
        variant: "destructive",
      });
      return false;
    }
  };

  // Process due reminders - with execution lock to prevent duplicates
  const processDueReminders = async (eventsToCheck: any[]) => {
    if (!eventsToCheck || eventsToCheck.length === 0 || isProcessing) return;

    setIsProcessing(true);
    
    try {
      const now = new Date();
      let notificationsTriggered = 0;
      
      for (const event of eventsToCheck) {
        const reminderTime = new Date(event.reminder_at);
        const reminderKey = `${event.id}-${event.reminder_at}`;
        
        // Check if reminder is due (within 1 minute window)
        const timeDiff = now.getTime() - reminderTime.getTime();
        const isDue = timeDiff >= 0 && timeDiff <= 60000; // 0 to 60 seconds past due time
        
        if (isDue && !processedReminders.has(reminderKey)) {
          console.log('🔔 PROCESSING EVENT REMINDER for event:', {
            id: event.id,
            title: event.title,
            reminderTime: reminderTime.toLocaleString(),
            currentTime: now.toLocaleString(),
            timeDiff: timeDiff,
            emailEnabled: event.email_reminder_enabled
          });
          
          // Mark as processed FIRST to prevent duplicate processing
          setProcessedReminders(prev => {
            const newSet = new Set([...prev, reminderKey]);
            console.log('✅ Marked as processed:', reminderKey);
            return newSet;
          });
          
          // Show dashboard notification
          showDashboardNotification(event.title || event.user_surname || 'Event');
          
          // Show system notification
          const result = await platformNotificationManager.createNotification({
            title: "📅 Event Reminder",
            body: `${t('events.eventReminder')}: ${event.title || event.user_surname || 'Event'}`,
            icon: "/favicon.ico",
            tag: `event-reminder-${event.id}`,
            requireInteraction: true,
          });
          
          if (result.success) {
            console.log('🔔 System notification sent successfully', result.fallbackUsed ? '(fallback used)' : '');
          } else {
            console.error('❌ System notification failed:', result.error);
          }
          
          // Send email reminder if enabled
          if (event.email_reminder_enabled) {
            const emailSuccess = await sendEmailReminder(event);
            console.log('📧 Email reminder result:', emailSuccess ? 'SUCCESS' : 'FAILED');
          } else {
            console.log('📧 Email reminder disabled for this event');
          }
          
          console.log('📊 Notification summary:', {
            dashboardNotification: '✅ Sent',
            systemNotification: result.success ? '✅ Sent' : '❌ Failed',
            emailReminder: event.email_reminder_enabled ? '✅ Processed' : '❌ Disabled'
          });
          
          notificationsTriggered++;
        }
      }

      if (notificationsTriggered > 0) {
        console.log(`🎯 Total event notifications triggered: ${notificationsTriggered}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Setup Supabase Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    console.log("🔗 Setting up Supabase realtime for event reminders");

    realtimeChannelRef.current = supabase
      .channel('event-reminders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('⚡ Realtime event change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['eventReminders', user.id] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      if (realtimeChannelRef.current) {
        console.log("🔌 Cleaning up realtime subscription");
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [user?.id, queryClient]);

  // Single interval for checking due reminders - prevents overlapping checks
  useEffect(() => {
    if (!events || events.length === 0) return;

    console.log("⏰ Starting single event reminder checker");

    intervalRef.current = setInterval(() => {
      processDueReminders(events);
    }, 2000); // Check every 2 seconds to reduce load

    return () => {
      if (intervalRef.current) {
        console.log("🛑 Stopping event reminder checker");
        clearInterval(intervalRef.current);
      }
    };
  }, [events, processedReminders]);

  // Clean up old processed reminders every hour
  useEffect(() => {
    const cleanup = setInterval(() => {
      console.log('🧹 Cleaning up old processed event reminders');
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      setProcessedReminders(prev => {
        const newSet = new Set<string>();
        prev.forEach(key => {
          const [, reminderTimeStr] = key.split('-');
          if (reminderTimeStr) {
            const reminderTime = new Date(reminderTimeStr);
            if (reminderTime > oneHourAgo) {
              newSet.add(key);
            }
          }
        });
        console.log('🧹 Event reminder cleanup complete. Before:', prev.size, 'After:', newSet.size);
        return newSet;
      });
    }, 60 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
