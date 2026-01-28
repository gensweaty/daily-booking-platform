import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardNotification, DashboardNotificationEvent } from '@/types/notifications';
import { usePublicBoardAuth } from '@/contexts/PublicBoardAuthContext';

const STORAGE_KEY_PREFIX = 'public-board-notifications-';
const MAX_NOTIFICATIONS = 100;
const CLEANUP_DAYS = 7;
const CLEANUP_HOURS = CLEANUP_DAYS * 24;

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

  // Compute identity key for this sub-user
  const userIdentity = publicBoardUser?.email;
  const boardOwnerId = publicBoardUser?.boardOwnerId;
  const storageKey = getStorageKey(userIdentity, boardOwnerId);

  // Load from localStorage when user changes
  useEffect(() => {
    // If user changed, reset
    const newKey = storageKey || null;
    if (currentUserKeyRef.current !== newKey) {
      currentUserKeyRef.current = newKey;
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
        const validNotifications = parsed
          .map(n => ({ ...n, timestamp: new Date(n.timestamp) }))
          .filter(n => n.timestamp > cutoff);
        setNotifications(validNotifications);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Failed to load public board notifications from localStorage:', error);
      setNotifications([]);
    }
  }, [storageKey]);

  // Save to localStorage when notifications change
  useEffect(() => {
    if (!storageKey) return;
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
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
      
      // ISOLATION FIX 1: Skip notifications explicitly meant for internal dashboard (admin)
      if (targetAudience === 'internal') {
        console.log('⏭️ [Public] Skipping notification meant for internal dashboard:', type);
        return;
      }

      // ISOLATION FIX 2: If recipientSubUserId is specified, only show to that specific sub-user
      // This prevents notifications from appearing in the wrong sub-user's dashboard
      if (recipientSubUserId && publicBoardUser?.id && recipientSubUserId !== publicBoardUser.id) {
        console.log('⏭️ [Public] Skipping notification meant for different sub-user:', { recipientSubUserId, currentSubUser: publicBoardUser.id });
        return;
      }

      // ISOLATION FIX 3: Email-based fallback check for sub-user targeting
      if (recipientSubUserEmail && publicBoardUser?.email && recipientSubUserEmail.toLowerCase() !== publicBoardUser.email.toLowerCase()) {
        console.log('⏭️ [Public] Skipping notification - email mismatch:', { recipientSubUserEmail, currentEmail: publicBoardUser.email });
        return;
      }

      // ISOLATION FIX 4: Skip if notification has recipientUserId (meant for admin, not sub-user)
      if (recipientUserId) {
        console.log('⏭️ [Public] Skipping notification targeted at admin user:', recipientUserId);
        return;
      }
      
      const newNotification: DashboardNotification = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        message,
        timestamp: new Date(),
        read: false,
        actionData,
      };

      setNotifications(prev => {
        const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
        return updated;
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
  }, [publicBoardUser?.id, publicBoardUser?.email]); // IMPORTANT: avoid stale sub-user closure on identity changes

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
