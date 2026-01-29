import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardNotification, DashboardNotificationEvent } from '@/types/notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY_PREFIX = 'dashboard-notifications-';
const MAX_NOTIFICATIONS = 100;
const CLEANUP_DAYS = 7; // Keep notifications for 7 days
const CLEANUP_HOURS = CLEANUP_DAYS * 24; // 168 hours
const FINGERPRINT_WINDOW_MS = 60000; // 60 seconds for soft deduplication

// Helper to get user-specific storage key
const getStorageKey = (userId: string | undefined) => {
  if (!userId) return null;
  return `${STORAGE_KEY_PREFIX}${userId}`;
};

// Helper to deduplicate notifications
const dedupeNotifications = (notifications: DashboardNotification[]): DashboardNotification[] => {
  const seen = new Map<string, DashboardNotification>();
  
  for (const n of notifications) {
    // For custom_reminder type, use reminderId as the unique key
    if (n.type === 'custom_reminder' && n.actionData?.reminderId) {
      const key = `reminder-${n.actionData.reminderId}`;
      if (!seen.has(key)) {
        seen.set(key, n);
      }
    } else if (n.type === 'event_reminder' && n.actionData?.eventId) {
      const key = `event-${n.actionData.eventId}`;
      if (!seen.has(key)) {
        seen.set(key, n);
      }
    } else {
      // For other types, use the notification id
      if (!seen.has(n.id)) {
        seen.set(n.id, n);
      }
    }
  }
  
  return Array.from(seen.values());
};

// Create fingerprint for soft deduplication
const createFingerprint = (type: string, title: string, message: string): string => {
  return `${type}::${title}::${message}`;
};

export const useDashboardNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [latestNotification, setLatestNotification] = useState<DashboardNotification | null>(null);
  const latestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadedMissedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const recentFingerprintsRef = useRef<Map<string, number>>(new Map());

  // Load from localStorage when user changes
  useEffect(() => {
    // If user changed, reset the loaded missed ref
    if (currentUserIdRef.current !== user?.id) {
      loadedMissedRef.current = false;
      currentUserIdRef.current = user?.id || null;
      recentFingerprintsRef.current.clear();
    }

    const storageKey = getStorageKey(user?.id);
    if (!storageKey) {
      // No user, clear notifications
      setNotifications([]);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as DashboardNotification[];
        // Convert timestamp strings back to Date objects and filter old ones
        const cutoff = new Date(Date.now() - CLEANUP_HOURS * 60 * 60 * 1000);
        const validNotifications = parsed
          .map(n => ({ ...n, timestamp: new Date(n.timestamp) }))
          .filter(n => n.timestamp > cutoff);
        // DEDUPLICATION: Ensure no duplicates on load
        setNotifications(dedupeNotifications(validNotifications));
      } else {
        // No stored notifications for this user
        setNotifications([]);
      }
    } catch (error) {
      console.error('Failed to load notifications from localStorage:', error);
      setNotifications([]);
    }
  }, [user?.id]);

  // Load missed notifications from database (reminders that triggered while user was offline)
  useEffect(() => {
    if (!user?.id || loadedMissedRef.current) return;
    
    const loadMissedNotifications = async () => {
      try {
        const sevenDaysAgo = new Date(Date.now() - CLEANUP_HOURS * 60 * 60 * 1000);
        
        // Fetch custom reminders that were sent in the last 7 days
        // ISOLATION FIX: Exclude sub-user created reminders - those belong to the sub-user only
        // Sub-user reminders are handled by PublicBoardReminderNotifications
        const { data: missedReminders, error } = await supabase
          .from('custom_reminders')
          .select('id, title, message, reminder_sent_at, created_by_type')
          .eq('user_id', user.id)
          .not('reminder_sent_at', 'is', null)
          .gte('reminder_sent_at', sevenDaysAgo.toISOString())
          .is('deleted_at', null)
          .or('created_by_type.is.null,created_by_type.neq.sub_user') // CRITICAL: Exclude sub-user reminders
          .order('reminder_sent_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching missed reminders:', error);
          return;
        }

        if (missedReminders && missedReminders.length > 0) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.actionData?.reminderId));
            const newNotifications: DashboardNotification[] = [];

            for (const reminder of missedReminders) {
              // Skip if we already have this notification
              if (existingIds.has(reminder.id)) continue;

              newNotifications.push({
                id: `custom_reminder-${reminder.id}-${Date.now()}`,
                type: 'custom_reminder',
                title: `🔔 Reminder: ${reminder.title}`,
                message: reminder.message || 'Scheduled reminder',
                timestamp: new Date(reminder.reminder_sent_at!),
                read: false,
                actionData: { reminderId: reminder.id }
              });
            }

            if (newNotifications.length === 0) return prev;

            // Merge and sort by timestamp (newest first)
            const merged = [...newNotifications, ...prev]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, MAX_NOTIFICATIONS);

            console.log(`📋 Loaded ${newNotifications.length} missed reminder notifications`);
            return merged;
          });
        }

        // Also fetch event reminders that were sent
        // ISOLATION FIX: Exclude sub-user created events - those belong to the sub-user only
        const { data: missedEventReminders, error: eventError } = await supabase
          .from('events')
          .select('id, title, reminder_sent_at, created_by_type')
          .eq('user_id', user.id)
          .not('reminder_sent_at', 'is', null)
          .gte('reminder_sent_at', sevenDaysAgo.toISOString())
          .is('deleted_at', null)
          .or('created_by_type.is.null,created_by_type.neq.sub_user') // CRITICAL: Exclude sub-user events
          .order('reminder_sent_at', { ascending: false })
          .limit(50);

        if (!eventError && missedEventReminders && missedEventReminders.length > 0) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.actionData?.eventId));
            const newNotifications: DashboardNotification[] = [];

            for (const event of missedEventReminders) {
              if (existingIds.has(event.id)) continue;

              newNotifications.push({
                id: `event_reminder-${event.id}-${Date.now()}`,
                type: 'event_reminder',
                title: `⏰ Event Reminder`,
                message: event.title,
                timestamp: new Date(event.reminder_sent_at!),
                read: false,
                actionData: { eventId: event.id }
              });
            }

            if (newNotifications.length === 0) return prev;

            const merged = [...newNotifications, ...prev]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, MAX_NOTIFICATIONS);

            console.log(`📋 Loaded ${newNotifications.length} missed event notifications`);
            return merged;
          });
        }

        loadedMissedRef.current = true;
      } catch (err) {
        console.error('Error loading missed notifications:', err);
      }
    };

    loadMissedNotifications();
  }, [user?.id]);

  // Save to localStorage when notifications change
  useEffect(() => {
    const storageKey = getStorageKey(user?.id);
    if (!storageKey) return; // Don't save if no user
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save notifications to localStorage:', error);
    }
  }, [notifications, user?.id]);

  // Listen for dashboard-notification events
  // CRITICAL: Only process notifications meant for internal dashboard (admin users)
  // AND only if the notification is for THIS specific user (recipient filtering)
  useEffect(() => {
    const handleNotificationEvent = (event: CustomEvent<DashboardNotificationEvent>) => {
      const { type, title, message, actionData, targetAudience, recipientUserId, recipientSubUserId, recipientSubUserEmail } = event.detail;
      
      console.log('📥 [Internal] Received dashboard-notification:', { type, targetAudience, recipientUserId, recipientSubUserId });
      
      // ISOLATION FIX 1: Skip notifications explicitly meant for public board sub-users
      if (targetAudience === 'public') {
        console.log('⏭️ [Internal] Skipping notification meant for public board:', type);
        return;
      }

      // ISOLATION FIX 2: If recipientUserId is specified, only show to that specific user
      // This prevents notifications from appearing in the wrong admin's dashboard
      if (recipientUserId && user?.id && recipientUserId !== user.id) {
        console.log('⏭️ [Internal] Skipping notification meant for different user:', { recipientUserId, currentUser: user.id });
        return;
      }

      // ISOLATION FIX 3: Skip if notification has recipientSubUserId (meant for sub-user, not admin)
      // CRITICAL: Only skip if sub-user targeting is explicit
      if (recipientSubUserId || recipientSubUserEmail) {
        console.log('⏭️ [Internal] Skipping notification targeted at sub-user:', { recipientSubUserId, recipientSubUserEmail });
        return;
      }
      
      // SOFT DEDUPLICATION: Use fingerprinting for duplicate detection within time window
      const fingerprint = createFingerprint(type, title, message);
      const now = Date.now();
      const lastSeen = recentFingerprintsRef.current.get(fingerprint);
      if (lastSeen && (now - lastSeen) < FINGERPRINT_WINDOW_MS) {
        console.log('⏭️ [Internal] Skipping duplicate notification (fingerprint):', fingerprint);
        return;
      }
      recentFingerprintsRef.current.set(fingerprint, now);

      // Clean old fingerprints periodically
      if (recentFingerprintsRef.current.size > 100) {
        const cutoff = now - FINGERPRINT_WINDOW_MS;
        for (const [key, timestamp] of recentFingerprintsRef.current.entries()) {
          if (timestamp < cutoff) {
            recentFingerprintsRef.current.delete(key);
          }
        }
      }

      // Use stable ID for reminders to prevent duplicates
      let notificationId: string;
      if (type === 'custom_reminder' && actionData?.reminderId) {
        notificationId = `internal-custom_reminder-${actionData.reminderId}`;
      } else if (type === 'event_reminder' && actionData?.eventId) {
        notificationId = `internal-event_reminder-${actionData.eventId}`;
      } else {
        notificationId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      
      const newNotification: DashboardNotification = {
        id: notificationId,
        type,
        title,
        message,
        timestamp: new Date(),
        read: false,
        actionData,
      };

      setNotifications(prev => {
        // HARD DEDUPLICATION: Check if we already have this notification
        if (type === 'custom_reminder' && actionData?.reminderId) {
          const exists = prev.some(n => 
            n.type === 'custom_reminder' && n.actionData?.reminderId === actionData.reminderId
          );
          if (exists) {
            console.log('⏭️ [Internal] Skipping duplicate reminder (in state):', actionData.reminderId);
            return prev;
          }
        }

        if (type === 'event_reminder' && actionData?.eventId) {
          const exists = prev.some(n => 
            n.type === 'event_reminder' && n.actionData?.eventId === actionData.eventId
          );
          if (exists) {
            console.log('⏭️ [Internal] Skipping duplicate event (in state):', actionData.eventId);
            return prev;
          }
        }

        // Filter out any existing notification with same stable ID
        const filtered = prev.filter(n => n.id !== notificationId);
        const updated = [newNotification, ...filtered].slice(0, MAX_NOTIFICATIONS);
        return updated;
      });
      setLatestNotification(newNotification);
      if (latestTimeoutRef.current) {
        clearTimeout(latestTimeoutRef.current);
      }
      latestTimeoutRef.current = setTimeout(() => {
        setLatestNotification(null);
      }, 5000);
    };

    window.addEventListener('dashboard-notification', handleNotificationEvent as EventListener);
    
    return () => {
      window.removeEventListener('dashboard-notification', handleNotificationEvent as EventListener);
      if (latestTimeoutRef.current) {
        clearTimeout(latestTimeoutRef.current);
      }
    };
  }, [user?.id]); // IMPORTANT: avoid stale user closure when switching accounts

  // Cleanup old notifications periodically
  useEffect(() => {
    const cleanup = () => {
      const cutoff = new Date(Date.now() - CLEANUP_HOURS * 60 * 60 * 1000);
      setNotifications(prev => prev.filter(n => new Date(n.timestamp) > cutoff));
    };

    const interval = setInterval(cleanup, 60 * 60 * 1000); // Every hour
    return () => clearInterval(interval);
  }, []);

  const addNotification = useCallback((event: DashboardNotificationEvent) => {
    window.dispatchEvent(new CustomEvent('dashboard-notification', { detail: event }));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setLatestNotification(null);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    latestNotification,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
};
