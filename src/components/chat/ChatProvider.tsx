import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicBoardAuth } from "@/contexts/PublicBoardAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChatIcon } from "./ChatIcon";
import { ChatWindow } from "./ChatWindow";
import { resolveAvatarUrl } from "./_avatar";
import { useToast } from "@/hooks/use-toast";
import { useEnhancedNotifications } from '@/hooks/useEnhancedNotifications';
import { useServerUnread } from "@/hooks/useServerUnread";
import { useEnhancedRealtimeChat } from '@/hooks/useEnhancedRealtimeChat';
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAIChannel } from "@/hooks/useAIChannel";

type Me = { 
  id: string; 
  type: "admin" | "sub_user"; 
  name: string; 
  email?: string;
  avatarUrl?: string 
};

type ChatCtx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isInitialized: boolean;
  hasSubUsers: boolean;
  me: Me | null;
  currentChannelId: string | null;
  setCurrentChannelId: (id: string | null) => void;
  openChannel: (id: string) => void;
  startDM: (otherId: string, otherType: "admin" | "sub_user") => void;
  unreadTotal: number;
  channelUnreads: { [channelId: string]: number };
  getUserUnreadCount: (userId: string, userType: 'admin' | 'sub_user') => number;
  channelMemberMap: Map<string, { id: string; type: 'admin' | 'sub_user' }>;
  boardOwnerId: string | null;
  connectionStatus: string;
  realtimeEnabled: boolean;
  isChannelRecentlyCleared: (channelId: string) => boolean;
  isPeerRecentlyCleared: (peerId: string, peerType: 'admin' | 'sub_user') => boolean;
  suppressChannelBadge: (channelId: string, ms?: number) => void;
  suppressPeerBadge: (peerId: string, peerType: 'admin' | 'sub_user', ms?: number) => void;
  isChannelBadgeSuppressed: (channelId: string) => boolean;
  isPeerBadgeSuppressed: (peerId: string, peerType: 'admin' | 'sub_user') => boolean;
  clearChannel: (channelId: string) => void;
  userChannels: Set<string>;
};

const ChatContext = createContext<ChatCtx | null>(null);

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
};

// Helper to read localStorage access
const getPublicAccess = (path: string) => {
  try {
    const slug = path.split('/').pop()!;
    const raw = localStorage.getItem(`public-board-access-${slug}`);
    if (!raw) return { hasAccess: false } as const;
    const parsed = JSON.parse(raw);
    const hasAccess = !!(parsed?.token && parsed?.email && parsed?.fullName && parsed?.boardOwnerId);
    return {
      hasAccess,
      slug,
      email: parsed?.email as string | undefined,
      fullName: parsed?.fullName as string | undefined,
      storedOwnerId: parsed?.boardOwnerId as string | undefined,
    } as const;
  } catch {
    return { hasAccess: false } as const;
  }
};

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { user: publicBoardUser } = usePublicBoardAuth();
  const { t } = useLanguage();

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [boardOwnerId, setBoardOwnerId] = useState<string | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [hasSubUsers, setHasSubUsers] = useState(false);
  const [channelMemberMap, setChannelMemberMap] = useState<Map<string, { id: string; type: 'admin' | 'sub_user' }>>(new Map());
  
  // Track recently cleared channels and peers to prevent badge beaming
  const [recentlyClearedChannels, setRecentlyClearedChannels] = useState<Map<string, number>>(new Map());
  const [recentlyClearedPeers, setRecentlyClearedPeers] = useState<Map<string, number>>(new Map());
  
  // Suppression system - force cache refresh
  const [suppressPulse, setSuppressPulse] = useState(0);
  const bumpSuppressPulse = useCallback(() => setSuppressPulse(p => (p + 1) & 0x7fffffff), []);

  // NEW state/refs for optimistic zeroing
  const [isSwitching, setIsSwitching] = useState(false);
  const optimisticZeroRef = React.useRef<Map<string, number>>(new Map()); // channelId -> untilTimestamp(ms)

  const channelSuppressRef = React.useRef<Map<string, number>>(new Map());
  const peerSuppressRef = React.useRef<Map<string, number>>(new Map());
  const pk = (id: string, type: 'admin' | 'sub_user') => `${type}:${id}`;

  const suppressChannelBadge = useCallback((channelId: string, ms = 1800) => {
    channelSuppressRef.current.set(channelId, Date.now() + ms);
    bumpSuppressPulse();
  }, [bumpSuppressPulse]);

  // Helper to mark "force-0 until <now+ms>"
  const forceZeroFor = useCallback((channelId: string, ms = 1800) => {
    optimisticZeroRef.current.set(channelId, Date.now() + ms);
    bumpSuppressPulse(); // ensure a re-render
  }, [bumpSuppressPulse]);

  const suppressPeerBadge = useCallback((peerId: string, peerType: 'admin' | 'sub_user', ms = 1800) => {
    peerSuppressRef.current.set(pk(peerId, peerType), Date.now() + ms);
    bumpSuppressPulse();
  }, [bumpSuppressPulse]);

  const isChannelBadgeSuppressed = useCallback((channelId: string) => {
    const now = Date.now();
    const t = channelSuppressRef.current.get(channelId) || 0;
    if (t && t <= now) { channelSuppressRef.current.delete(channelId); return false; }
    return t > now;
  }, []);

  const isPeerBadgeSuppressed = useCallback((peerId: string, peerType: 'admin' | 'sub_user') => {
    const now = Date.now();
    const key = pk(peerId, peerType);
    const t = peerSuppressRef.current.get(key) || 0;
    if (t && t <= now) { peerSuppressRef.current.delete(key); return false; }
    return t > now;
  }, []);
  
  // Show chat window when ready - minimal requirements
  const chatReady = !!boardOwnerId && !!me && isInitialized;

  // Portal root - memoized to prevent re-creation
  const portalRoot = useMemo(() => {
    let root = document.getElementById('chat-portal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'chat-portal-root';
      root.className = 'chat-portal-root';
      root.style.pointerEvents = 'none'; // default: pass-through
      root.style.zIndex = '12000'; // Chat band - below global overlays
      root.style.position = 'relative';
      document.body.appendChild(root);
    }
    // Keep z-index correct even if root already existed
    root.style.zIndex = '12000';
    root.style.pointerEvents = 'none';
    return root;
  }, []);

  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // Lock background scroll when chat is open on mobile
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "contain";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overscrollBehavior = prevOverscroll || "auto";
    };
  }, [isMobile, isOpen]);

  // Determine context variables
  const isOnPublicBoard = location.pathname.startsWith('/board/');
  const isOnDashboard = location.pathname.startsWith('/dashboard'); // Fix: Support all dashboard routes
  const effectiveUser = isOnPublicBoard ? publicBoardUser : user;

  // Initialize hasPublicAccess synchronously for immediate first render
  const [hasPublicAccess, setHasPublicAccess] = useState<boolean>(() => {
    // Sync read for the very first render
    try { 
      return getPublicAccess(window.location.pathname).hasAccess; 
    } catch { 
      return false; 
    }
  });

  // Guarantee the next render after a route change also has the right value
  React.useLayoutEffect(() => {
    try { 
      setHasPublicAccess(getPublicAccess(location.pathname).hasAccess); 
    } catch { 
      setHasPublicAccess(false); 
    }
  }, [location.pathname]);

  useEffect(() => {
    const read = () => setHasPublicAccess(getPublicAccess(location.pathname).hasAccess);

    // Keep fast polling + focus/visibility + storage listeners
    let alive = true;
    const fastDelays = [50, 100, 150, 200, 250, 300, 400, 500, 700, 1000];
    let i = 0;
    
    const tick = () => { 
      if (!alive) return; 
      read(); 
      if (i < fastDelays.length) setTimeout(tick, fastDelays[i++]); 
    };
    tick();

    // same-tab re-checks on focus/visibility change
    const onFocusish = () => read();
    window.addEventListener('focus', onFocusish);
    document.addEventListener('visibilitychange', onFocusish);

    // cross-tab changes
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes('public-board-access-')) read();
    };
    window.addEventListener('storage', onStorage);

    // custom event for immediate same-tab detection
    const onCustomEvent = (e: any) => {
      if (e?.detail?.slug && location.pathname.includes(e.detail.slug)) read();
    };
    window.addEventListener('public-board-access-updated', onCustomEvent as EventListener);

    return () => {
      alive = false;
      window.removeEventListener('focus', onFocusish);
      document.removeEventListener('visibilitychange', onFocusish);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('public-board-access-updated', onCustomEvent as EventListener);
    };
  }, [location.pathname, publicBoardUser?.id]);

  // Gate the icon on public login pages and business pages - chat should only appear on dashboard and public boards
  const onPublicLoginPage = isOnPublicBoard && location.pathname.includes('/login');
  const onBusinessPage = location.pathname.startsWith('/business/');
  const shouldShowChat = !onPublicLoginPage && !onBusinessPage && (isOnPublicBoard ? (!!publicBoardUser?.id || hasPublicAccess) : !!user?.id);
  
  // Detect external users for different handling
  const isExternalUser = isOnPublicBoard && hasPublicAccess && !user?.id;

  // State for realtime bumps
  const [rtBump, setRtBump] = useState<{ channelId?: string; createdAt?: string; senderType?: 'admin'|'sub_user'; senderId?: string; isSelf?: boolean } | undefined>(undefined);

  // Server-based unread management
  const {
    channelUnreads,
    unreadTotal,
    getPeerUnread,
    clearChannel,
    clearPeer,
    refresh: refreshUnread,
    userChannels
  } = useServerUnread(
    boardOwnerId,
    me?.type ?? null,
    me?.id ?? null,
    rtBump,
    isExternalUser,
    me?.email ?? null
  );

  // Wrapper for getUserUnreadCount to match old interface
  const getUserUnreadCount = useCallback((userId: string, userType: 'admin' | 'sub_user') => {
    return getPeerUnread(userId, userType);
  }, [getPeerUnread]);

  // NEW: identity key + hard reset when it changes
  const identityKey = useMemo(() => {
    if (isOnPublicBoard && boardOwnerId) return `pb:${boardOwnerId}:${me?.email || 'noemail'}`;
    if (!isOnPublicBoard && user?.id) return `admin:${user.id}`;
    return 'none';
  }, [isOnPublicBoard, boardOwnerId, me?.email, user?.id]);

  console.log('🔍 ChatProvider render:', {
    hasSubUsers,
    isInitialized,
    hasUser: !!user,
    shouldShowChat,
    me,
    boardOwnerId,
    identityKey
  });

  const prevIdentityKeyRef = React.useRef<string>('init');
  useEffect(() => {
    const prev = prevIdentityKeyRef.current;
    if (prev !== identityKey) {
      // Hard reset everything that could leak between users
      setCurrentChannelId(null);
      refreshUnread();
      setIsOpen(false);
      channelSuppressRef.current.clear();
      peerSuppressRef.current.clear();
      optimisticZeroRef.current.clear();
      setSuppressPulse(0);

      // tell ChatArea to drop its caches & timers
      window.dispatchEvent(new CustomEvent('chat-reset'));

      prevIdentityKeyRef.current = identityKey;
    }
  }, [identityKey, refreshUnread]);

  // When NO identity on public board -> clean out
  useEffect(() => {
    if (isOnPublicBoard && !publicBoardUser?.id && !hasPublicAccess) {
      setMe(null);
      setBoardOwnerId(null);
      setCurrentChannelId(null);
      setIsOpen(false);
      channelSuppressRef.current.clear();
      peerSuppressRef.current.clear();
      optimisticZeroRef.current.clear();
      setSuppressPulse(0);
      refreshUnread();
      window.dispatchEvent(new CustomEvent('chat-reset'));
    }
  }, [isOnPublicBoard, publicBoardUser?.id, hasPublicAccess, refreshUnread]);

  // Enhanced notifications - request permission immediately
  const { requestPermission, showNotification } = useEnhancedNotifications();

  // Request browser notification permission once the chat is available to the user
  useEffect(() => {
    if (shouldShowChat) {
      try { requestPermission(); } catch {}
    }
  }, [shouldShowChat, requestPermission]);

  // 🔁 Provider-level polling for external/public users (works even when chat UI is closed)
  useEffect(() => {
    // Preconditions: public board, has identity, external user (no dashboard session), and board owner resolved
    if (!isOnPublicBoard || !shouldShowChat || !isExternalUser || !boardOwnerId || !me?.id) return;

    let alive = true;
    // Start slightly in the past to avoid edge drops on first run
    let lastSeenISO = new Date(Date.now() - 2000).toISOString();

    const poll = async () => {
      if (!alive) return;
      try {
        // CRITICAL FIX: Only poll channels the user is a participant of
        const channelIds = Array.from(userChannels);
        if (channelIds.length === 0) return;

        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('owner_id', boardOwnerId)
          .in('channel_id', channelIds)
          .gt('created_at', lastSeenISO)
          .order('created_at', { ascending: true })
          .limit(200);

        if (error) throw error;
        if (!data || data.length === 0) return;

        // Dispatch each as if it arrived realtime; onPolledMessage will dedupe + notify
        for (const m of data) {
          const msg = { ...m, owner_id: m.owner_id || boardOwnerId };
          window.dispatchEvent(
            new CustomEvent('chat-message-received', { detail: { message: msg } })
          );
        }

        // Advance watermark
        lastSeenISO = data[data.length - 1].created_at;
      } catch (e) {
        // Soft-fail; keep polling
        console.log('⚠️ Public polling error:', (e as Error)?.message || e);
      }
    };

    // Poll regularly; also kick on focus/visibility/online to feel instantaneous
    const intervalMs = 3000;
    const id = setInterval(poll, intervalMs);
    poll();

    const kick = () => poll();
    window.addEventListener('focus', kick);
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('online', kick);

    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('focus', kick);
      document.removeEventListener('visibilitychange', kick);
      window.removeEventListener('online', kick);
    };
  }, [isOnPublicBoard, shouldShowChat, isExternalUser, boardOwnerId, me?.id, userChannels]);

  // Real-time subscription for participant changes to refresh unread data
  useEffect(() => {
    if (!me?.id || !boardOwnerId) return;

    // Real-time subscription for participant changes
    const participantChannel = supabase
      .channel(`participant-changes-${me.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_participants',
          filter: `${me.type === 'admin' ? 'user_id' : 'sub_user_id'}=eq.${me.id}`
        },
        (payload) => {
          console.log('🔄 Participant change detected:', payload);
          // Immediately refresh unread data to get updated participant channels
          refreshUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantChannel);
    };
  }, [me?.id, me?.type, boardOwnerId, refreshUnread]);

  // 🧩 Bridge POLLING -> the same unread pipeline as realtime + notifications
  useEffect(() => {
    const onPolledMessage = (evt: any) => {
      const message = evt?.detail?.message;
      if (!message || !message.channel_id) return;

      // SPECIAL CASE: Always notify for reminder alerts, regardless of sender
      const isReminderAlert = message.message_type === 'reminder_alert';
      if (isReminderAlert) {
        console.log('🔔 Reminder alert detected from polling - forcing notification');
        import('@/utils/audioManager')
          .then(({ playNotificationSound }) => playNotificationSound())
          .catch(() => {});
        showNotification({
          title: 'Reminder Alert',
          body: message.content,
          channelId: message.channel_id,
          senderId: message.sender_user_id || message.sender_sub_user_id || 'unknown',
          senderName: 'Smartbookly AI',
        });
        // Dispatch event for badge updates (sound already played, won't play again)
        window.dispatchEvent(new CustomEvent('chat-message-received', { detail: { message } }));
        return;
      }

      // Same guards as handleNewMessage
      if (boardOwnerId && message.owner_id && message.owner_id !== boardOwnerId) return;

      const isMyMessage = me?.type === 'admin'
        ? message.sender_user_id === me?.id
        : message.sender_sub_user_id === me?.id;

      if (!isMyMessage) {
        // de-dupe like handleNewMessage
        if (message?.id) {
          if (seenMessageIdsRef.current.has(message.id)) return;
          seenMessageIdsRef.current.add(message.id);
          if (seenMessageIdsRef.current.size > 3000) {
            seenMessageIdsRef.current.clear();
            seenMessageIdsRef.current.add(message.id);
          }
        }

        const skipBecauseOpen = isOpen && currentChannelId === message.channel_id;

        // ⛔ NEW: Don't bump unread while the user is viewing this channel
        if (!skipBecauseOpen) {
          setRtBump({
            channelId: message.channel_id,
            createdAt: message.created_at,
            senderType: message.sender_user_id ? 'admin' : 'sub_user',
            senderId: message.sender_user_id || message.sender_sub_user_id || 'ai',
            isSelf: false
          });
        }

        // 2) notifications (don't redispatch event here to avoid loops)
        if (!skipBecauseOpen) {
          // FIXED: Always check channel participation, even for public boards
          // Special handling for AI messages - they should always notify
          const isAIMessage = message.sender_name === 'Smartbookly AI';
          const shouldShow = isAIMessage || userChannels.has(message.channel_id);
          
          if (shouldShow) {
            import('@/utils/audioManager')
              .then(({ playNotificationSound }) => playNotificationSound())
              .catch(() => {});
            showNotification({
              title: `${message.sender_name || 'Someone'} messaged`,
              body: message.content,
              channelId: message.channel_id,
              senderId: message.sender_user_id || message.sender_sub_user_id || 'unknown',
              senderName: message.sender_name || 'Unknown',
            });
          }
        }
      }
    };

    window.addEventListener('chat-message-received', onPolledMessage as EventListener);
    return () => window.removeEventListener('chat-message-received', onPolledMessage as EventListener);
  }, [boardOwnerId, me?.id, me?.type, isOpen, currentChannelId, userChannels, showNotification, isOnPublicBoard]);

  // Avoid re-processing the same message (prevents repeat sounds & badge churn)
  const seenMessageIdsRef = React.useRef<Set<string>>(new Set());

  // Memoized real-time message handler to prevent re-renders
  const handleNewMessage = useCallback((message: any) => {
    console.log('📨 Enhanced realtime message received:', message);

    // SPECIAL CASE: Always notify for reminder alerts, regardless of sender
    const isReminderAlert = message.message_type === 'reminder_alert';
    if (isReminderAlert) {
      console.log('🔔 Reminder alert from realtime - forcing notification');
      import('@/utils/audioManager')
        .then(({ playNotificationSound }) => playNotificationSound())
        .catch(() => {});
      showNotification({
        title: 'Reminder Alert',
        body: message.content,
        channelId: message.channel_id,
        senderId: message.sender_user_id || message.sender_sub_user_id || 'unknown',
        senderName: 'Smartbookly AI',
      });
      // Dispatch event for badge updates (sound already played, won't play again)
      window.dispatchEvent(new CustomEvent('chat-message-received', { detail: { message } }));
      return;
    }

    // Handle message updates differently - don't dedupe updates
    const isUpdate = message._isUpdate;
    
    if (!isUpdate) {
      // Hard dedupe by message id across polling + realtime for new messages only
      if (message?.id) {
        if (seenMessageIdsRef.current.has(message.id)) {
          return; // already processed this one
        }
        seenMessageIdsRef.current.add(message.id);
        // optional tiny cap to avoid unbounded growth
        if (seenMessageIdsRef.current.size > 3000) {
          // drop oldest-ish by clearing (super rare) or rebuild smaller set if you prefer
          seenMessageIdsRef.current.clear();
          seenMessageIdsRef.current.add(message.id);
        }
      }
    }

    // STEP 2: Don't drop public messages that lack owner_id
    if (boardOwnerId && message.owner_id && message.owner_id !== boardOwnerId) {
      console.log('⏭️ Skipping message - owner mismatch');
      return;
    }

    // Skip my own messages for notifications but NOT for display
    const isMyMessage = me?.type === 'admin' 
      ? message.sender_user_id === me.id 
      : message.sender_sub_user_id === me.id;

    if (!isMyMessage && !isUpdate) {
      // ⛔ NEW: Don't bump unread while the user is viewing this channel
      const isViewingThisChannel = isOpen && currentChannelId === message.channel_id;
      
      if (!isViewingThisChannel) {
        // Create realtime bump for unread tracking (only for new messages, not updates)
        setRtBump({
          channelId: message.channel_id,
          createdAt: message.created_at,
          senderType: message.sender_user_id ? 'admin' : 'sub_user',
          senderId: message.sender_user_id || message.sender_sub_user_id || 'ai',
          isSelf: false
        });
      }

      // FIXED: Enhanced notification logic - only alert if user is a participant of the channel
      const shouldAlert = async () => {
        // Skip if chat is open and viewing the same channel
        if (isOpen && currentChannelId === message.channel_id) {
          console.log('⏭️ Skipping notification - chat is open and viewing same channel');
          return false;
        }
        
        // Special handling for AI messages - they should always notify
        const isAIMessage = message.sender_name === 'Smartbookly AI';
        if (isAIMessage) {
          console.log('✅ AI message - always notify');
          return true;
        }
        
        // CRITICAL: Only show notifications if user is a participant of this channel
        // Check both the cached userChannels and fallback to database verification for immediate accuracy
        if (userChannels.has(message.channel_id)) {
          console.log('✅ Fast path - user is participant of channel:', message.channel_id);
          return true; // Fast path - user is definitely a participant
        }
        
        // Fallback: Check database directly for immediate verification (handles new custom chats)
        console.log('🔍 Checking database for channel participation:', message.channel_id, 'user:', me?.id, 'type:', me?.type);
        try {
          const { data: participation } = await supabase
            .from('chat_participants')
            .select('id')
            .eq('channel_id', message.channel_id)
            .eq(me?.type === 'admin' ? 'user_id' : 'sub_user_id', me?.id)
            .eq('user_type', me?.type)
            .limit(1);
          
          console.log('📋 Database participation check result:', participation);
          if (participation && participation.length > 0) {
            console.log('✅ Database confirms user is participant of channel:', message.channel_id);
            // Trigger a refresh to update the userChannels cache
            refreshUnread();
            return true;
          }
        } catch (error) {
          console.error('❌ Error checking channel participation:', error);
        }
        
        console.log('⏭️ Skipping notification - user is not a participant of channel:', message.channel_id);
        return false;
      };

      shouldAlert().then((shouldShow) => {
        console.log('🔔 Should show notification for channel', message.channel_id, ':', shouldShow);
        if (shouldShow) {
          // Always play sound, regardless of notification permission/state
          console.log('🔊 Playing notification sound for custom/regular chat');
          import('@/utils/audioManager')
            .then(({ playNotificationSound }) => playNotificationSound())
            .catch((error) => console.error('❌ Failed to play sound:', error));
          
          // Also attempt system notification
          console.log('📱 Showing system notification');
          showNotification({
            title: `${message.sender_name || 'Someone'} messaged`,
            body: message.content,
            channelId: message.channel_id,
            senderId: message.sender_user_id || message.sender_sub_user_id || 'unknown',
            senderName: message.sender_name || 'Unknown',
          });
        }
      });
    } else if (isUpdate) {
      console.log('✏️ Message update - broadcasting to ChatArea');
    } else {
      console.log('⏭️ Skipping notification - own message');
    }

    // Direct message broadcasting (will be handled by cache in ChatArea)
    window.dispatchEvent(new CustomEvent('chat-message-received', {
      detail: { message }
    }));
  }, [boardOwnerId, me, isOpen, currentChannelId, showNotification, userChannels]);

  // Real-time setup - FIXED: enable only for authenticated users, external users use polling
  const realtimeEnabled = shouldShowChat && isInitialized && !!boardOwnerId && !!me?.id && !isExternalUser;
  const { connectionStatus } = useEnhancedRealtimeChat({
    onNewMessage: handleNewMessage,
    userId: me?.id,
    boardOwnerId: boardOwnerId || undefined,
    // Enable real-time for authenticated users only, external users rely on polling
    enabled: realtimeEnabled,
  });

  // Default channel with logging - prioritize AI channel for authenticated users
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  
  // Build stable identity key for per-member AI channel
  const aiIdentity = useMemo(() => {
    if (!boardOwnerId || !me) return undefined;
    // prefer UUID for sub_user; else email as fallback
    if (me.type === 'sub_user') {
      return me.id?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? `S:${me.id}` : (me.email ? me.email : undefined);
    }
    return `A:${me.id}`; // admin
  }, [boardOwnerId, me]);

  const { aiChannelId, loading: aiLoading } = useAIChannel(boardOwnerId, aiIdentity);

  useEffect(() => {
    if (!boardOwnerId) return;
    
    console.log('🔍 [CHAT] Fetching default (General) channel for board owner:', boardOwnerId);
    const channelStart = performance.now();
    
    supabase.rpc('get_default_channel_for_board', { p_board_owner_id: boardOwnerId })
      .then(({ data, error }) => {
        console.log('✅ [CHAT] Default channel fetch took:', performance.now() - channelStart, 'ms');
        if (!error && data?.[0]?.id) {
          setDefaultChannelId(data[0].id as string);
          console.log('🎯 [CHAT] General channel set:', data[0].id);
        } else {
          console.log('⚠️ [CHAT] No default channel found');
        }
      });
  }, [boardOwnerId]);

  // Prioritize AI channel as default for all users
  const effectiveDefaultChannel = aiChannelId || defaultChannelId;

  // If we learn the default channel later, auto-select it when nothing is selected yet
  // Wait for AI channel to finish loading before auto-selecting
  useEffect(() => {
    if (!currentChannelId && effectiveDefaultChannel && !aiLoading) {
      console.log('🎯 Auto-selecting default channel:', effectiveDefaultChannel, '(AI:', aiChannelId, 'General:', defaultChannelId, ')');
      setCurrentChannelId(effectiveDefaultChannel);
    }
  }, [effectiveDefaultChannel, currentChannelId, aiChannelId, defaultChannelId, aiLoading]);


  // Chat control functions - Open window immediately, no pending logic
  const open = useCallback(() => {
    if (!shouldShowChat) return;
    setIsOpen(true);
    // Ensure a channel exists as soon as the window appears (wait for AI to load first)
    if (!currentChannelId && effectiveDefaultChannel && !aiLoading) {
      setCurrentChannelId(effectiveDefaultChannel);
      // Clear unread for default channel when opening chat for external users
      if (isOnPublicBoard && me?.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(me.id)) {
        clearChannel(effectiveDefaultChannel);
      }
    }
  }, [shouldShowChat, currentChannelId, effectiveDefaultChannel, isOnPublicBoard, me?.id, clearChannel, aiLoading]);

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => {
    if (!shouldShowChat) return;
    setIsOpen(prev => {
      const next = !prev;
      if (next && !currentChannelId && effectiveDefaultChannel && !aiLoading) {
        setCurrentChannelId(effectiveDefaultChannel);
        // Clear unread for default channel when opening chat for external users
        if (isOnPublicBoard && me?.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(me.id)) {
          clearChannel(effectiveDefaultChannel);
        }
      }
      return next;
    });
  }, [shouldShowChat, currentChannelId, effectiveDefaultChannel, isOnPublicBoard, me?.id, clearChannel, aiLoading]);

  const openChannel = useCallback(async (channelId: string) => {
    // BULLETPROOF FIX: Clear unread count IMMEDIATELY before any other operations
    // This prevents React from ever rendering the old count
    clearChannel(channelId);
    
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(me?.id || '');
    const isExternalUser = !isValidUUID;

    suppressChannelBadge(channelId, isExternalUser ? 2500 : 1800);
    forceZeroFor(channelId, isExternalUser ? 2500 : 1800); // optimistic zero for target
    setIsSwitching(true);

    // Now switch channel
    setCurrentChannelId(channelId);
    setIsOpen(true);
    
    // Mark channel as read on server and clear local unread
    if (boardOwnerId && me?.type && me?.id) {
      
      try {
        if (isValidUUID) {
          await supabase.rpc('mark_channel_read', {
            p_owner_id: boardOwnerId,
            p_viewer_type: me.type,
            p_viewer_id: me.id,
            p_channel_id: channelId,
          });
          clearChannel(channelId);
          // Mark channel as recently cleared to prevent badge beaming
          setRecentlyClearedChannels(prev => new Map(prev.set(channelId, Date.now())));
          refreshUnread();
        } else {
          console.log('📧 [CHAT] External user - clearing local unread with debounce:', me.id);
          // Clear immediately for UI responsiveness
          clearChannel(channelId);
          // Mark channel as recently cleared to prevent badge beaming
          setRecentlyClearedChannels(prev => new Map(prev.set(channelId, Date.now())));
          
          // For external users, delay server refresh to prevent race conditions/flickering
          setTimeout(() => {
            // Only refresh if we're still on the same channel to avoid unnecessary updates
            if (currentChannelId === channelId) {
              console.log('🔄 Delayed refresh for external user after clearing:', channelId);
              refreshUnread();
            }
          }, 2000);
        }
      } catch (error) {
        console.error('❌ Error marking channel as read:', error);
        // Always clear local unread on error
        clearChannel(channelId);
        // Mark channel as recently cleared to prevent badge beaming
        setRecentlyClearedChannels(prev => new Map(prev.set(channelId, Date.now())));
        if (isValidUUID) {
          refreshUnread();
        }
      } finally {
        // small switch window to cover one repaint
        setTimeout(() => setIsSwitching(false), 200);
      }
    }
  }, [boardOwnerId, me, clearChannel, refreshUnread, currentChannelId, suppressChannelBadge, forceZeroFor]);

  // Check if a channel was recently cleared (within 4 seconds)
  const isChannelRecentlyCleared = useCallback((channelId: string) => {
    const clearedAt = recentlyClearedChannels.get(channelId);
    if (!clearedAt) return false;
    return Date.now() - clearedAt < 4000; // 4 second grace period
  }, [recentlyClearedChannels]);

  // Check if a peer was recently cleared (within 4 seconds)
  const isPeerRecentlyCleared = useCallback((peerId: string, peerType: 'admin' | 'sub_user') => {
    const peerKey = `${peerId}_${peerType}`;
    const clearedAt = recentlyClearedPeers.get(peerKey);
    if (!clearedAt) return false;
    return Date.now() - clearedAt < 4000; // 4 second grace period
  }, [recentlyClearedPeers]);

  // Clean up old entries from recentlyClearedChannels and peers every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      setRecentlyClearedChannels(prev => {
        const updated = new Map(prev);
        let hasChanges = false;
        
        for (const [channelId, clearedAt] of updated.entries()) {
          if (now - clearedAt > 5000) { // Clean up after 5 seconds
            updated.delete(channelId);
            hasChanges = true;
          }
        }
        
        return hasChanges ? updated : prev;
      });

      setRecentlyClearedPeers(prev => {
        const updated = new Map(prev);
        let hasChanges = false;
        
        for (const [peerKey, clearedAt] of updated.entries()) {
          if (now - clearedAt > 5000) { // Clean up after 5 seconds
            updated.delete(peerKey);
            hasChanges = true;
          }
        }
        
        return hasChanges ? updated : prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // FAST LOADING: Detailed logging to identify bottleneck
  useEffect(() => {
    let active = true;
    const startTime = performance.now();
    console.log('🚀 [CHAT] Starting initialization at', startTime);

    (async () => {
      setIsInitialized(false);

      // Step 1: Resolve board owner
      console.log('🔍 [CHAT] Step 1: Resolving board owner...');
      const step1Start = performance.now();
      
      const slug = location.pathname.split('/').pop()!;
      let resolvedBoardOwnerId;
      
      if (isOnPublicBoard) {
        const { data } = await supabase.from('public_boards').select('user_id').eq('slug', slug).maybeSingle();
        resolvedBoardOwnerId = data?.user_id;
      } else {
        resolvedBoardOwnerId = user?.id;
      }
      
      console.log('✅ [CHAT] Step 1 complete in', performance.now() - step1Start, 'ms. Board owner:', resolvedBoardOwnerId);
        
      if (!active || !resolvedBoardOwnerId) {
        console.log('❌ [CHAT] No board owner, stopping initialization');
        setIsInitialized(true);
        return;
      }

      setBoardOwnerId(resolvedBoardOwnerId);
      
      // Step 2: Set user identity
      console.log('🔍 [CHAT] Step 2: Setting user identity...');
      const step2Start = performance.now();
      
      if (!isOnPublicBoard && user) {
        // Admin user - skip profile fetch for now, use basic data
        console.log('👤 [CHAT] Admin user detected, using basic data');
        setMe({
          id: user.id,
          type: 'admin',
          name: user.email?.split('@')[0] || 'Admin',
          email: user.email,
        });
        console.log('✅ [CHAT] Step 2 complete in', performance.now() - step2Start, 'ms');
      } else if (isOnPublicBoard) {
        if (publicBoardUser?.id) {
          console.log('👤 [CHAT] Public board user detected, resolving UUID...');
          
          try {
            // Resolve the actual sub-user UUID from the database
            const { data: subUser, error: subUserError } = await supabase
              .from('sub_users')
              .select('id, email, fullname, avatar_url')
              .eq('board_owner_id', resolvedBoardOwnerId)
              .eq('email', publicBoardUser.email)
              .maybeSingle();
            
            if (!subUserError && subUser) {
              console.log('✅ [CHAT] Resolved sub-user UUID:', subUser.id);
              setMe({
                id: subUser.id, // Use actual UUID from database
                type: 'sub_user',
                name: subUser.fullname || publicBoardUser.fullName || 'Member',
                email: publicBoardUser.email,
                avatarUrl: subUser.avatar_url || undefined,
              });
            } else {
              console.log('⚠️ [CHAT] Using email as fallback ID');
              setMe({
                id: publicBoardUser.id, // Keep original (email) as fallback
                type: 'sub_user',
                name: publicBoardUser.fullName || publicBoardUser.email?.split('@')[0] || 'Member',
                email: publicBoardUser.email,
              });
            }
          } catch (error) {
            console.error('❌ [CHAT] Error resolving sub-user UUID:', error);
            setMe({
              id: publicBoardUser.id, // Fallback to original
              type: 'sub_user',
              name: publicBoardUser.fullName || publicBoardUser.email?.split('@')[0] || 'Member',
              email: publicBoardUser.email,
            });
          }
          console.log('✅ [CHAT] Step 2 complete in', performance.now() - step2Start, 'ms');
        } else if (hasPublicAccess) {
          console.log('👤 [CHAT] Public access user detected');
          const access = getPublicAccess(location.pathname);
          if (access.hasAccess && access.storedOwnerId === resolvedBoardOwnerId) {
            try {
              const { data: su } = await supabase
                .from('sub_users')
                .select('id, fullname, avatar_url')
                .eq('board_owner_id', resolvedBoardOwnerId)
                .eq('email', access.email)
                .maybeSingle();
              if (su?.id) {
                setMe({
                  id: su.id,
                  type: 'sub_user',
                  name: su.fullname || access.fullName,
                  email: access.email,
                  avatarUrl: su.avatar_url || undefined,
                });
              } else {
                setMe({
                  id: `guest-${access.email}`,
                  type: 'sub_user',
                  name: access.fullName,
                  email: access.email,
                });
              }
            } catch {
              setMe({
                id: `guest-${access.email}`,
                type: 'sub_user',
                name: access.fullName,
                email: access.email,
              });
            }
            console.log('✅ [CHAT] Step 2 complete in', performance.now() - step2Start, 'ms');
          }
        }
      }

      if (active) {
        console.log('🎯 [CHAT] Setting initialized to true');
        setIsInitialized(true);
        console.log('🏁 [CHAT] Total initialization time:', performance.now() - startTime, 'ms');
      }
    })();

    return () => { active = false; };
  }, [isOnPublicBoard, user?.id, publicBoardUser?.id, hasPublicAccess, location.pathname]);

  // ❌ REMOVED: Old normalization logic is no longer needed since the migration handles it

  // Simple channel mapping - only when needed
  useEffect(() => {
    if (!boardOwnerId || !me || !isOpen) return; // Only fetch when chat is actually opened

    const fetchChannelMemberMap = async () => {
      try {
        const newMap = new Map<string, { id: string; type: 'admin' | 'sub_user' }>();

        if (me.type === 'admin') {
          // Get DM channels - map to the "other" participant
          const { data: dmChannels } = await supabase
            .from('chat_channels')
            .select('id, chat_participants(user_id, sub_user_id, user_type)')
            .eq('owner_id', boardOwnerId)
            .eq('is_dm', true);

          dmChannels?.forEach((channel: any) => {
            const participants = channel.chat_participants || [];
            const otherParticipant = participants.find((p: any) => 
              !(p.user_type === 'admin' && p.user_id === me.id)
            );

            if (otherParticipant) {
              const memberId = otherParticipant.user_id || otherParticipant.sub_user_id;
              const memberType = otherParticipant.user_type as 'admin' | 'sub_user';
              
              if (memberId && memberType) {
                newMap.set(channel.id, { id: memberId, type: memberType });
              }
            }
          });

          // Get custom chats - track them properly for unread counts
          const { data: customChannels } = await supabase
            .from('chat_channels')
            .select('id, name, created_by_type, created_by_id, chat_participants(user_id, sub_user_id, user_type)')
            .eq('owner_id', boardOwnerId)
            .eq('is_custom', true)
            .eq('is_deleted', false);

          customChannels?.forEach((channel: any) => {
            // Check if current user is a participant in this custom chat
            const participants = channel.chat_participants || [];
            const isParticipant = participants.some((p: any) => 
              (me.type === 'admin' && p.user_type === 'admin' && p.user_id === me.id) ||
              (me.type === 'sub_user' && p.user_type === 'sub_user' && p.sub_user_id === me.id)
            );

            if (isParticipant) {
              // For custom chats, use a special identifier to prevent DM attribution but allow unread tracking
              newMap.set(channel.id, { 
                id: `custom_${channel.id}`, // Use channel ID to avoid collisions
                type: channel.created_by_type as 'admin' | 'sub_user' 
              });
              console.log('📍 Added custom chat to channel map:', { channelId: channel.id, name: channel.name });
            }
          });
        } else if (me.type === 'sub_user') {
          // Handle sub-users (for external/public board users)
          console.log('👤 Fetching channel member map for sub-user:', me.id);
          
          // Get DM channels for sub-user - map to the "other" participant
          const { data: dmChannels } = await supabase
            .from('chat_channels')
            .select('id, chat_participants(user_id, sub_user_id, user_type)')
            .eq('owner_id', boardOwnerId)
            .eq('is_dm', true);

          dmChannels?.forEach((channel: any) => {
            const participants = channel.chat_participants || [];
            // Check if this sub-user is a participant
            const isMyChannel = participants.some((p: any) => 
              p.user_type === 'sub_user' && p.sub_user_id === me.id
            );
            
            if (isMyChannel) {
              // Find the other participant (not me)
              const otherParticipant = participants.find((p: any) => 
                !(p.user_type === 'sub_user' && p.sub_user_id === me.id)
              );

              if (otherParticipant) {
                const memberId = otherParticipant.user_id || otherParticipant.sub_user_id;
                const memberType = otherParticipant.user_type as 'admin' | 'sub_user';
                
                if (memberId && memberType) {
                  newMap.set(channel.id, { id: memberId, type: memberType });
                  console.log('📍 Added DM channel for sub-user:', { channelId: channel.id, otherMember: { id: memberId, type: memberType } });
                }
              }
            }
          });

          // Get custom chats for sub-user
          const { data: customChannels } = await supabase
            .from('chat_channels')
            .select('id, name, created_by_type, created_by_id, chat_participants(user_id, sub_user_id, user_type)')
            .eq('owner_id', boardOwnerId)
            .eq('is_custom', true)
            .eq('is_deleted', false);

          customChannels?.forEach((channel: any) => {
            // Check if current sub-user is a participant in this custom chat
            const participants = channel.chat_participants || [];
            const isParticipant = participants.some((p: any) => 
              p.user_type === 'sub_user' && p.sub_user_id === me.id
            );

            if (isParticipant) {
              // For custom chats, use a special identifier to prevent DM attribution but allow unread tracking
              newMap.set(channel.id, { 
                id: `custom_${channel.id}`, // Use channel ID to avoid collisions
                type: channel.created_by_type as 'admin' | 'sub_user' 
              });
              console.log('📍 Added custom chat to channel map for sub-user:', { channelId: channel.id, name: channel.name });
            }
          });
        }

        setChannelMemberMap(newMap);
      } catch (error) {
        console.error('❌ Error fetching channel mapping:', error);
      }
    };

    fetchChannelMemberMap();
  }, [boardOwnerId, me, isOpen]); // Only when chat opens

  // Check for sub-users (always allow chat to show)
  useEffect(() => {
    if (boardOwnerId) {
      supabase
        .from("sub_users")
        .select("id")
        .eq("board_owner_id", boardOwnerId)
        .limit(1)
        .then(({ data }) => {
          setHasSubUsers((data?.length || 0) > 0);
        });
    } else {
      setHasSubUsers(false);
    }
  }, [boardOwnerId]);
  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!boardOwnerId || !me) {
      console.log('❌ Cannot start DM - missing prerequisites');
      return;
    }

    try {
      console.log('🔍 Starting DM for:', { 
        meType: me.type, 
        meId: me.id, 
        otherId, 
        otherType, 
        boardOwnerId 
      });

      // For sub-users on public boards, resolve the actual UUID if ID is email-based
      let resolvedMyId = me.id;
      if (me.type === 'sub_user' && isOnPublicBoard && me.email && me.id?.includes('@')) {
        console.log('🔍 Resolving sub-user UUID for DM creation:', me.email);
        const { data: subUser } = await supabase
          .from('sub_users')
          .select('id')
          .eq('board_owner_id', boardOwnerId)
          .eq('email', me.email)
          .maybeSingle();
        
        if (subUser?.id) {
          resolvedMyId = subUser.id;
          console.log('✅ Resolved sub-user UUID for DM:', resolvedMyId);
        }
      }

      // Use the canonical find_or_create_dm RPC with resolved IDs
      const { data: channelId, error } = await supabase.rpc('find_or_create_dm', {
        p_owner_id: boardOwnerId,
        p_a_type: me.type,
        p_a_id: resolvedMyId,
        p_b_type: otherType,
        p_b_id: otherId
      });

      if (error) {
        console.error('❌ find_or_create_dm RPC failed:', error);
        toast({
          title: 'Error',
          description: 'Failed to start DM. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ DM channel created/found:', channelId);
      
      setCurrentChannelId(channelId as string);
      setIsOpen(true);

      // Mark DM channel as read on server and clear local unread
      if (channelId) {
        // Suppress badge for this channel during operation
        suppressChannelBadge(channelId as string);
        
        try {
          await supabase.rpc('mark_channel_read', {
            p_owner_id: boardOwnerId,
            p_viewer_type: me.type,
            p_viewer_id: resolvedMyId,
            p_channel_id: channelId as string,
          });
          clearChannel(channelId as string);
          clearPeer(otherId, otherType);
          // Mark peer as recently cleared to prevent badge beaming
          setRecentlyClearedPeers(prev => new Map(prev.set(`${otherId}_${otherType}`, Date.now())));
          refreshUnread();
        } catch (error) {
          console.error('❌ Error marking DM as read:', error);
        }
      }

    } catch (error: any) {
      console.error('❌ Error in startDM:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start direct message',
        variant: 'destructive',
      });
    }
  }, [boardOwnerId, me, toast, clearChannel, clearPeer, refreshUnread, suppressChannelBadge, isOnPublicBoard]);

  // Create an immutable snapshot to ensure consumers re-render on bumps
  const channelUnreadsSnapshot = useMemo(
    () => ({ ...channelUnreads }),
    [channelUnreads] // Remove rtBump - it causes premature snapshot before useServerUnread updates
  );

  // Build UI-facing counts (masked) - SIMPLIFIED for instant clearing
  const uiChannelUnreads = useMemo(() => {
    const now = Date.now();
    const out: Record<string, number> = {};

    for (const [cid, raw] of Object.entries(channelUnreadsSnapshot)) {
      // PRIORITY 1: Current channel is ALWAYS zero (most important rule)
      if (cid === currentChannelId) {
        out[cid] = 0;
        continue;
      }
      
      let v = Math.max(0, raw || 0);

      // Other suppression rules apply only if NOT current channel
      // 2) optimistic zero during switch/open
      const until = optimisticZeroRef.current.get(cid) || 0;
      if (until > now) { out[cid] = 0; continue; }

      // 3) recent clear grace window
      if (isChannelRecentlyCleared(cid)) { out[cid] = 0; continue; }

      // 4) explicit suppression map
      if (isChannelBadgeSuppressed(cid)) { out[cid] = 0; continue; }

      out[cid] = v;
    }

    return out;
    // include everything that can change the mask
  }, [channelUnreadsSnapshot, currentChannelId, suppressPulse, recentlyClearedChannels, isChannelRecentlyCleared, isChannelBadgeSuppressed]);

  // Compute a stable total from the same masked counts
  const uiUnreadTotal = useMemo(
    () => Object.values(uiChannelUnreads).reduce((a, b) => a + (b || 0), 0),
    [uiChannelUnreads]
  );

  // Context value - memoized to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    isOpen,
    open,
    close,
    toggle,
    isInitialized,
    hasSubUsers,
    me,
    currentChannelId,
    setCurrentChannelId,
    openChannel,
    startDM,
    unreadTotal: uiUnreadTotal,
    channelUnreads: uiChannelUnreads,
    getUserUnreadCount,
    channelMemberMap,
    boardOwnerId,
    connectionStatus,
    realtimeEnabled: realtimeEnabled && !isExternalUser,
    isChannelRecentlyCleared,
    isPeerRecentlyCleared,
    suppressChannelBadge,
    suppressPeerBadge,
    isChannelBadgeSuppressed,
    isPeerBadgeSuppressed,
    clearChannel,
    userChannels,
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers, me, currentChannelId, openChannel, startDM, uiUnreadTotal, uiChannelUnreads, getUserUnreadCount, channelMemberMap, boardOwnerId, connectionStatus, realtimeEnabled, isExternalUser, isChannelRecentlyCleared, isPeerRecentlyCleared, suppressChannelBadge, suppressPeerBadge, isChannelBadgeSuppressed, isPeerBadgeSuppressed, clearChannel, userChannels]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
      {shouldShowChat && portalRoot && createPortal(
        <div className="contents" key={identityKey}>
          {!isOpen && (
            <div id="chat-floating-root" className="fixed bottom-4 right-4 z-[40]">
              <ChatIcon 
                onClick={toggle} 
                isOpen={isOpen} 
                unreadCount={uiUnreadTotal}
                isPending={false}
                teamChatText={t('chat.teamChat')}
                loadingText={t('chat.loading')}
              />
            </div>
          )}
          {isOpen && (
            <div
              id="chat-overlay"
              className="fixed inset-0 pointer-events-none z-[12000]"
            >
              <ChatWindow isOpen={isOpen} onClose={close} />
            </div>
          )}
        </div>,
        portalRoot
      )}
    </ChatContext.Provider>
  );
};