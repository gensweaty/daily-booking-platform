
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usePublicBoardAuth } from "@/contexts/PublicBoardAuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { platformNotificationManager } from "@/utils/platformNotificationManager";

/**
 * Event reminder notifications for sub-users on public boards.
 * Only processes events created by this specific sub-user.
 * Dispatches to Dynamic Island with targetAudience='public'.
 */
export const PublicBoardEventReminderNotifications = () => {
  const { user: publicBoardUser } = usePublicBoardAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [processedReminders, setProcessedReminders] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const boardOwnerId = publicBoardUser?.boardOwnerId;
  const subUserName = publicBoardUser?.fullName;
  const subUserEmail = publicBoardUser?.email;
  const subUserId = publicBoardUser?.id;

  // Get stable storage key for this sub-user
  const storageKey = subUserEmail && boardOwnerId 
    ? `processedPublicEventReminders-${boardOwnerId}-${subUserEmail.toLowerCase()}` 
    : null;

  // Load processed reminders from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProcessedReminders(new Set(parsed));
        console.log("📅 [Public] Loaded processed event reminders from storage:", parsed.length);
      }
    } catch (error) {
      console.error("❌ [Public] Error loading processed event reminders:", error);
    }
  }, [storageKey]);

  // Save processed reminders to localStorage whenever they change
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(processedReminders)));
    } catch (error) {
      console.error("❌ [Public] Error saving processed event reminders:", error);
    }
  }, [processedReminders, storageKey]);

  // Fetch events with reminders created by this sub-user
  const { data: events } = useQuery({
    queryKey: ['publicEventReminders', boardOwnerId, subUserName, subUserEmail],
    queryFn: async () => {
      if (!boardOwnerId) return [];
      
      // Need to identify events created by this sub-user
      // Match by created_by_name (fullname or email)
      const identifiers: string[] = [];
      if (subUserName) identifiers.push(subUserName);
      if (subUserEmail) identifiers.push(subUserEmail);
      
      if (identifiers.length === 0) return [];
      
      const now = new Date();
      const futureWindow = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window
      
      // Build OR filter for created_by_name matching any of the identifiers
      const orFilters = identifiers.map(id => `created_by_name.eq.${id}`).join(',');
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', boardOwnerId)
        .eq('created_by_type', 'sub_user')
        .or(orFilters)
        .not('reminder_at', 'is', null)
        .eq('email_reminder_enabled', true)
        .lte('reminder_at', futureWindow.toISOString())
        .is('deleted_at', null)
        .order('reminder_at', { ascending: true });
      
      if (error) {
        console.error('❌ [Public] Error fetching event reminders:', error);
        throw error;
      }
      
      // Filter out events with invalid or missing IDs
      const filtered = (data || []).filter(ev => !!ev.id && typeof ev.id === 'string');
      console.log('📅 [Public] Event reminders fetched for sub-user:', filtered.length);
      return filtered;
    },
    enabled: !!boardOwnerId && !!(subUserName || subUserEmail),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Show dashboard notification
  const showDashboardNotification = (eventTitle: string) => {
    console.log("📊 [Public] Showing dashboard notification for event:", eventTitle);
    toast({
      title: "📅 Event Reminder",
      description: `${t('events.eventReminder')}: ${eventTitle}`,
      duration: 8000,
    });
  };

  // Process due reminders
  const processDueReminders = async (eventsToCheck: any[]) => {
    if (!eventsToCheck || eventsToCheck.length === 0 || isProcessing) return;

    setIsProcessing(true);
    
    try {
      const now = new Date();
      let notificationsTriggered = 0;
      
      for (const event of eventsToCheck) {
        if (!event || !event.id || !event.reminder_at) continue;
        
        const reminderTime = new Date(event.reminder_at);
        const reminderKey = `${event.id}-${event.reminder_at}`;
        
        // Check if reminder is due
        const timeDiff = now.getTime() - reminderTime.getTime();
        const isDue = timeDiff >= -5000 && timeDiff <= 55000;
        
        if (isDue && !processedReminders.has(reminderKey)) {
          console.log('🔔 [Public] PROCESSING EVENT REMINDER for event:', event.title);
          
          // Mark as processed FIRST to prevent duplicate processing
          setProcessedReminders(prev => {
            const newSet = new Set([...prev, reminderKey]);
            console.log('✅ [Public] Marked as processed:', reminderKey);
            return newSet;
          });
          
          // Show dashboard notification (toast)
          showDashboardNotification(event.title || event.user_surname || 'Event');

          const eventTitle = event.title || event.user_surname || 'Event';

          // Emit to Dynamic Island - PUBLIC board targeting with recipient info
          window.dispatchEvent(new CustomEvent('dashboard-notification', {
            detail: {
              type: 'event_reminder',
              title: '📅 Event Reminder',
              message: `${t('events.eventReminder')}: ${eventTitle}`,
              actionData: { eventId: event.id },
              targetAudience: 'public',
              recipientSubUserId: subUserId,
              recipientSubUserEmail: subUserEmail
            }
          }));
          
          // Show system notification
          const result = await platformNotificationManager.createNotification({
            title: "📅 Event Reminder",
            body: `${t('events.eventReminder')}: ${eventTitle}`,
            icon: "/favicon.ico",
            tag: `public-event-reminder-${event.id}`,
            requireInteraction: true,
          });
          
          if (result.success) {
            console.log('🔔 [Public] System notification sent successfully');
          }
          
          notificationsTriggered++;
        }
      }

      if (notificationsTriggered > 0) {
        console.log(`🎯 [Public] Total event notifications triggered: ${notificationsTriggered}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Single interval for checking due reminders
  useEffect(() => {
    if (!events || events.length === 0) return;

    console.log("⏰ [Public] Starting event reminder checker");

    intervalRef.current = setInterval(() => {
      processDueReminders(events);
    }, 2000); // Check every 2 seconds

    return () => {
      if (intervalRef.current) {
        console.log("🛑 [Public] Stopping event reminder checker");
        clearInterval(intervalRef.current);
      }
    };
  }, [events, processedReminders]);

  // Clean up old processed reminders every hour
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      setProcessedReminders(prev => {
        const newSet = new Set<string>();
        prev.forEach(key => {
          const parts = key.split('-');
          const reminderTimeStr = parts.slice(1).join('-');
          if (reminderTimeStr) {
            const reminderTime = new Date(reminderTimeStr);
            if (reminderTime > oneHourAgo) {
              newSet.add(key);
            }
          }
        });
        return newSet;
      });
    }, 60 * 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  return null; // This component only handles notifications, no UI
};
