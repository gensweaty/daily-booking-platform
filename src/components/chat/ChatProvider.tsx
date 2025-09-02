import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicBoardAuth } from "@/contexts/PublicBoardAuthContext";
import { ChatIcon } from "./ChatIcon";
import { ChatWindow } from "./ChatWindow";
import { resolveAvatarUrl } from "./_avatar";
import { useToast } from "@/hooks/use-toast";
import { useEnhancedNotifications } from '@/hooks/useEnhancedNotifications';
import { useServerUnread } from "@/hooks/useServerUnread";
import { useEnhancedRealtimeChat } from '@/hooks/useEnhancedRealtimeChat';
import { getEffectivePublicEmail } from '@/utils/chatEmail';

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
  verifyAndSetChannel: (id: string) => Promise<void>;
  openChannel: (id: string) => void;
  startDM: (otherId: string, otherType: "admin" | "sub_user") => void;
  unreadTotal: number;
  channelUnreads: { [channelId: string]: number };
  getUserUnreadCount: (userId: string, userType: 'admin' | 'sub_user') => number;
  channelMemberMap: Map<string, { id: string; type: 'admin' | 'sub_user' }>;
  boardOwnerId: string | null;
  connectionStatus: string;
  realtimeEnabled: boolean;
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

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [boardOwnerId, setBoardOwnerId] = useState<string | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [hasSubUsers, setHasSubUsers] = useState(false);
  const [channelMemberMap, setChannelMemberMap] = useState<Map<string, { id: string; type: 'admin' | 'sub_user' }>>(new Map());
  
  // Show chat window when ready - minimal requirements
  const chatReady = !!boardOwnerId && !!me && isInitialized;

  // Portal root - memoized to prevent re-creation
  const portalRoot = useMemo(() => {
    let root = document.getElementById('chat-portal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'chat-portal-root';
      root.style.position = 'fixed';
      root.style.top = '0';
      root.style.left = '0';
      root.style.width = '100%';
      root.style.height = '100%';
      root.style.pointerEvents = 'none';
      root.style.zIndex = '9998';
      document.body.appendChild(root);
    }
    return root;
  }, []);

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

  // Gate the icon on public login pages and show immediately on localStorage access
  const onPublicLoginPage = isOnPublicBoard && location.pathname.includes('/login');
  const shouldShowChat = !onPublicLoginPage && (isOnPublicBoard ? (!!publicBoardUser?.id || hasPublicAccess) : !!user?.id);

  // State for realtime bumps
  const [rtBump, setRtBump] = useState<{ channelId?: string; createdAt?: string; senderType?: 'admin'|'sub_user'; senderId?: string; isSelf?: boolean } | undefined>(undefined);

  // Server-based unread management
  const {
    channelUnreads,
    unreadTotal,
    getPeerUnread,
    clearChannel,
    clearPeer,
    refresh: refreshUnread
  } = useServerUnread(
    boardOwnerId,
    me?.type ?? null,
    me?.id ?? null,
    rtBump
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
      refreshUnread();
      window.dispatchEvent(new CustomEvent('chat-reset'));
    }
  }, [isOnPublicBoard, publicBoardUser?.id, hasPublicAccess, refreshUnread]);

  // Enhanced notifications - request permission immediately
  const { requestPermission, showNotification } = useEnhancedNotifications();

  // 🧩 Bridge POLLING -> the same unread pipeline as realtime
  useEffect(() => {
    const onPolledMessage = (evt: any) => {
      const message = evt?.detail?.message;
      if (!message || !message.channel_id) return;

      // Same guards as handleNewMessage
      if (boardOwnerId && message.owner_id && message.owner_id !== boardOwnerId) return;

      const isMyMessage = me?.type === 'admin'
        ? message.sender_user_id === me?.id
        : message.sender_sub_user_id === me?.id;

      if (!isMyMessage) {
        // Create realtime bump for polled messages
        setRtBump({
          channelId: message.channel_id,
          createdAt: message.created_at,
          senderType: message.sender_user_id ? 'admin' : 'sub_user',
          senderId: message.sender_user_id || message.sender_sub_user_id,
          isSelf: false
        });
      }
    };

    window.addEventListener('chat-message-received', onPolledMessage as EventListener);
    return () => window.removeEventListener('chat-message-received', onPolledMessage as EventListener);
  }, [boardOwnerId, me?.id, me?.type]);

  // Avoid re-processing the same message (prevents repeat sounds & badge churn)
  const seenMessageIdsRef = React.useRef<Set<string>>(new Set());

  // Memoized real-time message handler to prevent re-renders
  const handleNewMessage = useCallback((message: any) => {
    console.log('📨 Enhanced realtime message received:', message);

    // Hard dedupe by message id across polling + realtime
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

    // STEP 2: Don't drop public messages that lack owner_id
    if (boardOwnerId && message.owner_id && message.owner_id !== boardOwnerId) {
      console.log('⏭️ Skipping message - owner mismatch');
      return;
    }

    // Skip my own messages for notifications but NOT for display
    const isMyMessage = me?.type === 'admin' 
      ? message.sender_user_id === me.id 
      : message.sender_sub_user_id === me.id;

    if (!isMyMessage) {
      // Create realtime bump for unread tracking
      setRtBump({
        channelId: message.channel_id,
        createdAt: message.created_at,
        senderType: message.sender_user_id ? 'admin' : 'sub_user',
        senderId: message.sender_user_id || message.sender_sub_user_id,
        isSelf: false
      });

      // FIXED: Simplified notification logic - alert for messages not in currently open channel
      const shouldAlert = () => {
        // Skip if chat is open and viewing the same channel
        if (isOpen && currentChannelId === message.channel_id) {
          return false;
        }
        return true; // Alert for any channel that isn't currently open
      };

      if (shouldAlert()) {
        // Always play sound, regardless of notification permission/state
        import('@/utils/audioManager')
          .then(({ playNotificationSound }) => playNotificationSound())
          .catch(() => {});
        
        // Also attempt system notification
        showNotification({
          title: `${message.sender_name || 'Someone'} messaged`,
          body: message.content,
          channelId: message.channel_id,
          senderId: message.sender_user_id || message.sender_sub_user_id || 'unknown',
          senderName: message.sender_name || 'Unknown',
        });
      }
    } else {
      console.log('⏭️ Skipping notification - own message');
    }

    // Direct message broadcasting (will be handled by cache in ChatArea)
    window.dispatchEvent(new CustomEvent('chat-message-received', {
      detail: { message }
    }));
  }, [boardOwnerId, me, isOpen, currentChannelId, showNotification]);

  // Real-time setup - FIXED: enable for both admin and authenticated public board users
  const realtimeEnabled = shouldShowChat && isInitialized && !!boardOwnerId && !!me?.id;
  const { connectionStatus } = useEnhancedRealtimeChat({
    onNewMessage: handleNewMessage,
    userId: me?.id,
    boardOwnerId: boardOwnerId || undefined,
    // Enable real-time for authenticated users, disable for public board access only
    enabled: realtimeEnabled,
  });

  // Default channel with logging
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  useEffect(() => {
    if (!boardOwnerId) return;
    
    console.log('🔍 [CHAT] Fetching default channel for board owner:', boardOwnerId);
    const channelStart = performance.now();
    
    supabase.rpc('get_default_channel_for_board', { p_board_owner_id: boardOwnerId })
      .then(({ data, error }) => {
        console.log('✅ [CHAT] Default channel fetch took:', performance.now() - channelStart, 'ms');
        if (!error && data?.[0]?.id) {
          setDefaultChannelId(data[0].id as string);
          console.log('🎯 [CHAT] Default channel set:', data[0].id);
        } else {
          console.log('⚠️ [CHAT] No default channel found');
        }
      });
  }, [boardOwnerId]);

  // If we learn the default channel later, auto-select it when nothing is selected yet
  useEffect(() => {
    if (!currentChannelId && defaultChannelId) {
      console.log('🎯 Auto-selecting default channel:', defaultChannelId);
      setCurrentChannelId(defaultChannelId);
    }
  }, [defaultChannelId, currentChannelId]);

  // Polling fallback for public board users when real-time is unavailable
  useEffect(() => {
    if (!isOnPublicBoard || !me || !boardOwnerId || isOpen || !defaultChannelId) return;
    
    console.log('🔄 Starting message polling for public board user');
    let lastPollTime = Date.now();
    
    const pollForMessages = async () => {
      try {
        const { data: messages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('owner_id', boardOwnerId)
          .gte('created_at', new Date(lastPollTime).toISOString())
          .order('created_at', { ascending: true });
        
        if (messages && messages.length > 0) {
          console.log(`📬 Polling found ${messages.length} new messages`);
          messages.forEach(message => handleNewMessage(message));
          lastPollTime = Date.now();
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    };
    
    const pollInterval = setInterval(pollForMessages, 15000); // Poll every 15 seconds
    
    return () => {
      console.log('🛑 Stopping message polling');
      clearInterval(pollInterval);
    };
  }, [isOnPublicBoard, me, boardOwnerId, isOpen, defaultChannelId, handleNewMessage]);

  // Chat control functions - Open window immediately, no pending logic
  const open = useCallback(() => {
    if (!shouldShowChat) return;
    setIsOpen(true);
    // Ensure a channel exists as soon as the window appears (if we already know it)
    if (!currentChannelId && defaultChannelId) setCurrentChannelId(defaultChannelId);
  }, [shouldShowChat, currentChannelId, defaultChannelId]);

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => {
    if (!shouldShowChat) return;
    setIsOpen(prev => {
      const next = !prev;
      if (next && !currentChannelId && defaultChannelId) {
        setCurrentChannelId(defaultChannelId);
      }
      return next;
    });
  }, [shouldShowChat, currentChannelId, defaultChannelId]);

  // Channel verification - prevents forced fallback to General
  const verifyAndSetChannel = useCallback(async (nextId: string) => {
    if (!nextId || !boardOwnerId || !me) return;
    
    const onPublicBoard = location.pathname.startsWith('/board/');
    const isSubUser = me?.type === 'sub_user';

    try {
      if (onPublicBoard && isSubUser) {
        const effectiveEmail = getEffectivePublicEmail(location.pathname, me?.email);
        if (!effectiveEmail) {
          toast({ title: "You need to log in to the board chat", variant: "destructive" });
          return;
        }
        
        // ✅ use public header RPC to validate sub-user access to this channel
        const { data: hdr, error } = await supabase.rpc('get_channel_header_public', {
          p_owner_id: boardOwnerId,
          p_channel_id: nextId,
          p_requester_email: effectiveEmail,
        });
        if (error || !hdr?.length) return; // silently ignore invalid channel
        setCurrentChannelId(nextId);       // accept selection
        setIsOpen(true);

        // Mark channel as read
        try {
          await supabase.rpc('mark_channel_read', {
            p_owner_id: boardOwnerId,
            p_viewer_type: me.type,
            p_viewer_id: me.id,
            p_channel_id: nextId,
          });
          clearChannel(nextId);
        } catch {}
        return;
      }

      // existing internal/admin path (unchanged)
      const { data: hdrInt, error: e2 } = await supabase.rpc('get_channel_header_internal', {
        p_owner_id: boardOwnerId,
        p_channel_id: nextId,
        p_viewer_id: me?.id,
        p_viewer_type: me?.type,
      });
      if (!e2 && hdrInt?.length) {
        setCurrentChannelId(nextId);
        setIsOpen(true);
        
        // Mark channel as read
        try {
          await supabase.rpc('mark_channel_read', {
            p_owner_id: boardOwnerId,
            p_viewer_type: me.type,
            p_viewer_id: me.id,
            p_channel_id: nextId,
          });
          clearChannel(nextId);
        } catch {}
      }
    } catch (err) {
      console.error('Channel verification failed:', err);
    }
  }, [boardOwnerId, me, location.pathname, clearChannel, toast]);

  const openChannel = useCallback(async (channelId: string) => {
    await verifyAndSetChannel(channelId);
  }, [verifyAndSetChannel]);

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
          console.log('👤 [CHAT] Public board user detected');
          setMe({
            id: publicBoardUser.id,
            type: 'sub_user',
            name: publicBoardUser.fullName || publicBoardUser.email?.split('@')[0] || 'Member',
            email: publicBoardUser.email,
          });
          console.log('✅ [CHAT] Step 2 complete in', performance.now() - step2Start, 'ms');
        } else if (hasPublicAccess) {
          console.log('👤 [CHAT] Public access user detected');
          const access = getPublicAccess(location.pathname);
          if (access.hasAccess && access.storedOwnerId === resolvedBoardOwnerId) {
            setMe({
              id: `guest-${access.email}`,
              type: 'sub_user',
              name: access.fullName,
              email: access.email,
            });
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

  // helper for extracting channel ID from RPC returns
  const extractChannelId = (data: any): string | null => {
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      if ('id' in data && data.id) return data.id as string;
      if ('channel_id' in data && data.channel_id) return data.channel_id as string;
    }
    if (Array.isArray(data) && data.length) {
      const first = data[0];
      if (first?.id) return first.id as string;
      if (first?.channel_id) return first.channel_id as string;
    }
    return null;
  };

  // ❌ REMOVED: Old normalization logic is no longer needed since the migration handles it

  // Simple channel mapping - only when needed
  useEffect(() => {
    if (!boardOwnerId || !me || !isOpen) return; // Only fetch when chat is actually opened

    const fetchChannelMemberMap = async () => {
      try {
        const newMap = new Map<string, { id: string; type: 'admin' | 'sub_user' }>();

        if (me.type === 'admin') {
          // Simple admin path - just DM channels
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
      console.log('🔍 Using canonical find_or_create_dm RPC for:', { me, otherId, otherType });

      const { data, error } = await supabase.rpc('find_or_create_dm', {
        p_owner_id: boardOwnerId,
        p_a_type: me.type,
        p_a_id: me.id,
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

      const newChannelId = extractChannelId(data);
      if (!newChannelId) {
        console.error('find_or_create_dm returned no id:', data);
        toast({ title: 'Error', description: 'Could not open DM', variant: 'destructive' });
        return;
      }

      console.log('✅ Canonical DM channel created/found:', newChannelId);
      setCurrentChannelId(newChannelId);
      setIsOpen(true);

      // Mark DM channel as read on server and clear local unread
      try {
        await supabase.rpc('mark_channel_read', {
          p_owner_id: boardOwnerId,
          p_viewer_type: me.type,
          p_viewer_id: me.id,
          p_channel_id: newChannelId,
        });
        clearChannel(newChannelId);
        clearPeer(otherId, otherType);
        refreshUnread();
      } catch (error) {
        console.error('❌ Error marking DM as read:', error);
      }

    } catch (error: any) {
      console.error('❌ Error in startDM:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start direct message',
        variant: 'destructive',
      });
    }
  }, [boardOwnerId, me, toast, clearChannel, clearPeer, refreshUnread]);

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
    verifyAndSetChannel,
    openChannel,
    startDM,
    unreadTotal,
    channelUnreads,
    getUserUnreadCount,
    channelMemberMap,
    boardOwnerId,
    connectionStatus,
    realtimeEnabled,
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers, me, currentChannelId, verifyAndSetChannel, openChannel, startDM, unreadTotal, channelUnreads, getUserUnreadCount, channelMemberMap, boardOwnerId, connectionStatus, realtimeEnabled]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
      {shouldShowChat && portalRoot && createPortal(
        <div key={identityKey}>
          {!isOpen && (
            <ChatIcon 
              onClick={toggle} 
              isOpen={isOpen} 
              unreadCount={unreadTotal}
              // No more spinner loop on the icon
              isPending={false}
            />
          )}
          {isOpen && (
            <ChatWindow isOpen={isOpen} onClose={close} />
          )}
        </div>,
        portalRoot
      )}
    </ChatContext.Provider>
  );
};