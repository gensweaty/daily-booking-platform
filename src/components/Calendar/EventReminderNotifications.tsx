
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell } from "lucide-react";
import { platformNotificationManager } from "@/utils/platformNotificationManager";
import { createEventReminder } from "@/lib/reminderScheduler";

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

  // Fetch events with reminders - now also creates reminder entries for backend
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
        .eq('email_reminder_enabled', true)
        .is('deleted_at', null)
        .order('reminder_at', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching event reminders:', error);
        throw error;
      }
      
      // Create reminder entries for backend processing for events that don't have them
      if (data) {
        for (const event of data) {
          // Check if reminder entry already exists
          const { data: existing } = await supabase
            .from('reminder_entries')
            .select('id')
            .eq('event_id', event.id)
            .eq('type', 'event')
            .single();

          if (!existing && event.reminder_at && event.email_reminder_enabled) {
            console.log('📅 Creating reminder entry for event:', event.title || event.user_surname);
            await createEventReminder(
              event.id,
              user.id,
              event.title || event.user_surname || 'Event',
              event.reminder_at
            );
          }
        }
      }
      
      console.log('📅 Event reminders fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Show dashboard notification
  const showDashboardNotification = (eventTitle: string) => {
    console.log("📊 Showing dashboard notification for event:", eventTitle);
    toast({
      title: "📅 Event Reminder",
      description: `${t('common.reminder')}: ${eventTitle}`,
      duration: 8000,
      action: (
        <div className="flex items-center">
          <Bell className="h-4 w-4" />
        </div>
      ),
    });
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
          const eventTitle = event.title || event.user_surname || 'Event';
          console.log('🔔 PROCESSING REMINDER for event:', eventTitle);
          console.log('⏰ Reminder time:', reminderTime.toLocaleString());
          console.log('🕐 Current time:', now.toLocaleString());
          console.log('⏱️ Time difference:', timeDiff, 'ms');
          
          // Mark as processed FIRST to prevent duplicate processing
          setProcessedReminders(prev => {
            const newSet = new Set([...prev, reminderKey]);
            console.log('✅ Marked as processed:', reminderKey);
            return newSet;
          });
          
          // Show dashboard notification
          showDashboardNotification(eventTitle);
          
          // Show system notification
          const result = await platformNotificationManager.createNotification({
            title: "📅 Event Reminder",
            body: `${t('common.reminder')}: ${eventTitle}`,
            icon: "/favicon.ico",
            tag: `event-reminder-${event.id}`,
            requireInteraction: true,
          });
          
          if (result.success) {
            console.log('🔔 System notification sent successfully', result.fallbackUsed ? '(fallback used)' : '');
          } else {
            console.error('❌ System notification failed:', result.error);
          }
          
          // Note: Email sending is now handled by the backend cron job via reminder_entries table
          console.log('📊 Dashboard notification: ✅ Sent');
          console.log('🔔 System notification:', result.success ? '✅ Sent' : '❌ Failed');
          console.log('📧 Email reminder: ✅ Backend will handle');
          
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

    console.log("⏰ Starting event reminder checker");

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
        console.log('🧹 Event cleanup complete. Before:', prev.size, 'After:', newSet.size);
        return newSet;
      });
    }, 60 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
