import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardNotification, DashboardNotificationEvent } from '@/types/notifications';
import { usePublicBoardAuth } from '@/contexts/PublicBoardAuthContext';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY_PREFIX = 'public-board-notifications-';
const MAX_NOTIFICATIONS = 100;
const CLEANUP_DAYS = 7;
const CLEANUP_HOURS = CLEANUP_DAYS * 24;

const dedupeNotifications = (items: DashboardNotification[]) => {
  // Primary dedupe requirement: a reminder should appear only once (by reminderId)
  const reminderSeen = new Set<string>();
  const generalSeen = new Set<string>();
  const out: DashboardNotification[] = [];

  for (const n of items) {
    if (n.type === 'custom_reminder') {
      const rid = (n.actionData as any)?.reminderId as string | undefined;
      const key = rid ? `custom_reminder:${rid}` : `custom_reminder:${n.id}`;
      if (reminderSeen.has(key)) continue;
      reminderSeen.add(key);
      out.push(n);
      continue;
    }

    // Keep other notifications stable by id (do not over-dedupe different messages)
    const key = `${n.type}:${n.id}`;
    if (generalSeen.has(key)) continue;
    generalSeen.add(key);
    out.push(n);
  }

  return out;
};

// Helper to get user-specific storage key for public board users
const getStorageKey = (email: string | undefined, boardOwnerId: string | undefined) => {
  if (!email || !boardOwnerId) return null;
  // Use email + boardOwnerId to create unique key per sub-user per board
  return `${STORAGE_KEY_PREFIX}${boardOwnerId}-${email.toLowerCase()}`;
};

export const usePublicBoardNotifications = () => {
  const { user: publicBoardUser, isPublicBoard } = usePublicBoardAuth();
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [latestNotification, setLatestNotification] = useState<DashboardNotification | null>(null);
  const latestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserKeyRef = useRef<string | null>(null);
  const loadedMissedRef = useRef(false);
  const recentFingerprintsRef = useRef<Map<string, number>>(new Map());
  const seenReminderIdsRef = useRef<Set<string>>(new Set());

  // NOTE: PublicBoardAuthContext historically used email as a temporary `id`.
  // Some dispatchers emit `recipientSubUserId` as the real UUID.
  // We must therefore validate by UUID when we have one, otherwise fall back to email.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const currentSubUserId = publicBoardUser?.id;
  const currentSubUserIdIsUuid = !!(currentSubUserId && uuidRe.test(currentSubUserId));
  const currentEmail = publicBoardUser?.email?.toLowerCase();

  // Resolve actual sub_user UUID from database (fallback for email-based IDs)
  const [resolvedSubUserId, setResolvedSubUserId] = useState<string | null>(null);

  // Compute identity key for this sub-user
  const userIdentity = publicBoardUser?.email;
  const boardOwnerId = publicBoardUser?.boardOwnerId;
  const storageKey = getStorageKey(userIdentity, boardOwnerId);

  // Keep a fast lookup of reminder IDs we already have to prevent duplicates
  useEffect(() => {
    const s = new Set<string>();
    for (const n of notifications) {
      const reminderId = (n.type === 'custom_reminder' && (n.actionData as any)?.reminderId) ? (n.actionData as any).reminderId : null;
      if (reminderId) s.add(reminderId);
    }
    seenReminderIdsRef.current = s;
  }, [notifications]);

  const stableStringify = (value: unknown) => {
    try {
      if (!value) return '';
      const sortObj = (v: any): any => {
        if (Array.isArray(v)) return v.map(sortObj);
        if (v && typeof v === 'object') {
          return Object.keys(v)
            .sort()
            .reduce((acc: any, k) => {
              acc[k] = sortObj(v[k]);
              return acc;
            }, {});
        }
        return v;
      };
      return JSON.stringify(sortObj(value));
    } catch {
      return '';
    }
  };

  const makeFingerprint = (evt: Pick<DashboardNotificationEvent, 'type' | 'title' | 'message' | 'actionData'>) => {
    return `${evt.type}|${evt.title}|${evt.message}|${stableStringify(evt.actionData)}`;
  };

  const shouldSkipDuplicate = (evt: Pick<DashboardNotificationEvent, 'type' | 'title' | 'message' | 'actionData'>) => {
    // Hard de-dupe for reminders: one notification per reminder id
    if (evt.type === 'custom_reminder') {
      const reminderId = (evt.actionData as any)?.reminderId as string | undefined;
      if (reminderId && seenReminderIdsRef.current.has(reminderId)) return true;
    }

    // Soft de-dupe for other notifications: identical payload within a short window
    const fingerprint = makeFingerprint(evt);
    const now = Date.now();
    const windowMs = 60_000; // 60s is enough to collapse multi-mount / double-dispatch issues

    // Cleanup old fingerprints
    for (const [k, ts] of recentFingerprintsRef.current.entries()) {
      if (now - ts > windowMs) recentFingerprintsRef.current.delete(k);
    }

    const lastTs = recentFingerprintsRef.current.get(fingerprint);
    if (lastTs && now - lastTs <= windowMs) return true;

    recentFingerprintsRef.current.set(fingerprint, now);
    return false;
  };

  // Resolve UUID from email if needed (async database lookup)
  useEffect(() => {
    if (currentSubUserIdIsUuid) {
      // Already have UUID, use it directly
      setResolvedSubUserId(currentSubUserId);
      return;
    }
    
    // ID is email-based, resolve actual UUID from database
    if (!currentEmail || !boardOwnerId) {
      setResolvedSubUserId(null);
      return;
    }
    
    console.log('🔍 [PublicNotifications] Resolving sub-user UUID for email:', currentEmail);
    // CRITICAL FIX: Use RPC (SECURITY DEFINER) to bypass RLS restrictions
    // Direct sub_users queries fail for unauthenticated public board users
    supabase
      .rpc('get_sub_user_auth', {
        p_owner_id: boardOwnerId,
        p_email: currentEmail
      })
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ [PublicNotifications] Error resolving sub-user UUID via RPC:', error);
          return;
        }
        const subUser = data && data[0];
        if (subUser?.id) {
          console.log('✅ [PublicNotifications] Resolved sub-user UUID via RPC:', subUser.id);
          setResolvedSubUserId(subUser.id);
        } else {
          console.log('⚠️ [PublicNotifications] No sub-user found for email:', currentEmail);
          setResolvedSubUserId(null);
        }
      });
  }, [currentSubUserId, currentSubUserIdIsUuid, currentEmail, boardOwnerId]);


  // Load from localStorage when user changes
  useEffect(() => {
    // If user changed, reset
    const newKey = storageKey || null;
    if (currentUserKeyRef.current !== newKey) {
      currentUserKeyRef.current = newKey;
      loadedMissedRef.current = false;
      recentFingerprintsRef.current.clear();
    }

    if (!storageKey) {
      // No user identity, clear notifications
      setNotifications([]);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as DashboardNotification[];
        // Convert timestamp strings back to Date objects and filter old ones
        const cutoff = new Date(Date.now() - CLEANUP_HOURS * 60 * 60 * 1000);
        const validNotifications = dedupeNotifications(parsed
          .map(n => ({ ...n, timestamp: new Date(n.timestamp) }))
          .filter(n => n.timestamp > cutoff));
        setNotifications(validNotifications);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Failed to load public board notifications from localStorage:', error);
      setNotifications([]);
    }
  }, [storageKey]);

  // If duplicates were already present in memory (e.g., from older versions), collapse them immediately.
  useEffect(() => {
    setNotifications((prev) => {
      const next = dedupeNotifications(prev);
      return next.length === prev.length ? prev : next;
    });
  }, [storageKey]);

  // Backfill last 7 days of sub-user reminders (so users see missed alerts across refresh/offline)
  useEffect(() => {
    const effectiveSubUserId = resolvedSubUserId || currentSubUserId;
    const effectiveIdIsUuid = !!(effectiveSubUserId && uuidRe.test(effectiveSubUserId));

    if (!storageKey) return;
    if (!boardOwnerId) return;
    if (!effectiveSubUserId) return;
    if (!effectiveIdIsUuid) return; // require real UUID to match created_by_sub_user_id
    if (loadedMissedRef.current) return;

    const loadMissed = async () => {
      try {
        const now = new Date();
        const sevenDaysAgo = new Date(Date.now() - CLEANUP_HOURS * 60 * 60 * 1000);

        const { data, error } = await supabase
          .from('custom_reminders')
          .select('id, title, message, remind_at, reminder_sent_at, created_at')
          .eq('user_id', boardOwnerId)
          .eq('created_by_type', 'sub_user')
          .eq('created_by_sub_user_id', effectiveSubUserId)
          .gte('remind_at', sevenDaysAgo.toISOString())
          .lte('remind_at', now.toISOString())
          .is('deleted_at', null)
          .order('remind_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('❌ [PublicNotifications] Error fetching missed reminders:', error);
          loadedMissedRef.current = true;
          return;
        }

        if (data && data.length > 0) {
          setNotifications(prev => {
            const existingReminderIds = new Set(
              prev
                .filter(n => n.type === 'custom_reminder')
                .map(n => (n.actionData as any)?.reminderId)
                .filter(Boolean)
            );

            const toAdd: DashboardNotification[] = [];
            for (const r of data) {
              if (existingReminderIds.has(r.id)) continue;
              const ts = r.reminder_sent_at || r.remind_at || r.created_at;
              toAdd.push({
                id: `public-custom_reminder-${r.id}`,
                type: 'custom_reminder',
                title: `🔔 Reminder: ${r.title}`,
                message: r.message || 'Scheduled reminder',
                timestamp: new Date(ts),
                read: false,
                actionData: { reminderId: r.id },
              });
            }

            if (toAdd.length === 0) return prev;

            return [...toAdd, ...prev]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, MAX_NOTIFICATIONS);
          });
        }

        loadedMissedRef.current = true;
      } catch (e) {
        console.error('❌ [PublicNotifications] Error loading missed reminders:', e);
        loadedMissedRef.current = true;
      }
    };

    loadMissed();
  }, [storageKey, boardOwnerId, resolvedSubUserId, currentSubUserId]);

  // Save to localStorage when notifications change
  useEffect(() => {
    if (!storageKey) return;
    
    try {
      // Persist a deduped view to prevent runaway duplication across reloads
      localStorage.setItem(storageKey, JSON.stringify(dedupeNotifications(notifications)));
    } catch (error) {
      console.error('Failed to save public board notifications to localStorage:', error);
    }
  }, [notifications, storageKey]);

  // Listen for dashboard-notification events (same event name, shared dispatch mechanism)
  // CRITICAL: Only process notifications meant for public board sub-users
  // AND only if the notification is for THIS specific sub-user (recipient filtering)
  useEffect(() => {
    const handleNotificationEvent = (event: CustomEvent<DashboardNotificationEvent>) => {
      const { type, title, message, actionData, targetAudience, recipientSubUserId, recipientSubUserEmail, recipientUserId } = event.detail;
      
      // Use resolved UUID if available, otherwise fall back to current ID
      const effectiveSubUserId = resolvedSubUserId || currentSubUserId;
      const effectiveIdIsUuid = !!(effectiveSubUserId && uuidRe.test(effectiveSubUserId));
      
      console.log('📥 [Public] Received dashboard-notification:', { 
        type, 
        targetAudience, 
        recipientSubUserId, 
        recipientSubUserEmail, 
        recipientUserId, 
        currentSubUserId, 
        resolvedSubUserId,
        effectiveSubUserId,
        currentEmail 
      });
      
      // ISOLATION FIX 1: Skip notifications explicitly meant for internal dashboard (admin)
      if (targetAudience === 'internal') {
        console.log('⏭️ [Public] Skipping notification meant for internal dashboard:', type);
        return;
      }

      // ISOLATION FIX 2: Skip if notification has recipientUserId (meant for admin, not sub-user)
      if (recipientUserId) {
        console.log('⏭️ [Public] Skipping notification targeted at admin user:', recipientUserId);
        return;
      }

      // ISOLATION FIX 3: If recipientSubUserId or recipientSubUserEmail is specified, only show to that specific sub-user.
      if (recipientSubUserId || recipientSubUserEmail) {
        // Try UUID match using effective (resolved) ID
        const uuidMatch = effectiveIdIsUuid && effectiveSubUserId && recipientSubUserId === effectiveSubUserId;
        
        // Try email match (case-insensitive) - with normalized comparison
        const normalizedRecipientEmail = recipientSubUserEmail?.toLowerCase()?.trim();
        const normalizedCurrentEmail = currentEmail?.toLowerCase()?.trim();
        const emailMatch = !!(normalizedCurrentEmail && normalizedRecipientEmail && 
          normalizedRecipientEmail === normalizedCurrentEmail);
        
        console.log('🔍 [Public] Identity match check:', { 
          uuidMatch, 
          emailMatch, 
          effectiveSubUserId, 
          recipientSubUserId, 
          normalizedCurrentEmail, 
          normalizedRecipientEmail 
        });
        
        if (!uuidMatch && !emailMatch) {
          console.log('⏭️ [Public] Skipping notification - no identity match');
          return;
        }
        
        console.log('✅ [Public] Identity matched for notification');
      } else if (targetAudience === 'public') {
        // If targetAudience is 'public' but no specific recipient is set,
        // this is a general notification for the current public board user - accept it
        console.log('✅ [Public] Accepting general public notification (no specific recipient)');
      }

      // DE-DUPE: Prevent the same reminder/message from being added multiple times
      if (shouldSkipDuplicate({ type, title, message, actionData })) {
        console.log('⏭️ [Public] Skipping duplicate notification');
        return;
      }

      // If no recipient targeting at all and targetAudience is 'public', accept for this sub-user
      // This handles general notifications meant for all public board users
      
      const newNotification: DashboardNotification = {
        id: type === 'custom_reminder' && (actionData as any)?.reminderId
          ? `public-custom_reminder-${(actionData as any).reminderId}`
          : `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        message,
        timestamp: new Date(),
        read: false,
        actionData,
      };

      setNotifications(prev => {
        // Hard guarantee: reminders are unique by reminderId; also remove same id if somehow re-added.
        const reminderId = (newNotification.type === 'custom_reminder')
          ? (newNotification.actionData as any)?.reminderId
          : undefined;

        const filtered = prev.filter((n) => {
          if (newNotification.type === 'custom_reminder' && reminderId) {
            const nRid = (n.type === 'custom_reminder') ? (n.actionData as any)?.reminderId : undefined;
            if (nRid && nRid === reminderId) return false;
          }
          return n.id !== newNotification.id;
        });

        return dedupeNotifications([newNotification, ...filtered]).slice(0, MAX_NOTIFICATIONS);
      });

      // Show latest notification for 5 seconds
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
  }, [publicBoardUser?.id, publicBoardUser?.email, resolvedSubUserId, currentSubUserId, currentEmail]); // IMPORTANT: update when resolved UUID changes

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
    isPublicBoard,
  };
};
