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
import { useUnreadManager } from '@/hooks/useUnreadManager';
import { useEnhancedRealtimeChat } from '@/hooks/useEnhancedRealtimeChat';

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
  
  // Chat ready state - removed pendingOpen logic
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

  // Enhanced unread management - memoized dependencies  
  const {
    unreadTotal,
    channelUnreads,
    memberUnreads,
    incrementUnread,
    clearChannelUnread,
    clearUserUnread,
    getUserUnreadCount,
    clearAllUnread,
  } = useUnreadManager(currentChannelId, isOpen, channelMemberMap);

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
      clearAllUnread();
      setIsOpen(false);

      // tell ChatArea to drop its caches & timers
      window.dispatchEvent(new CustomEvent('chat-reset'));

      prevIdentityKeyRef.current = identityKey;
    }
  }, [identityKey, clearAllUnread]);

  // When NO identity on public board -> clean out
  useEffect(() => {
    if (isOnPublicBoard && !publicBoardUser?.id && !hasPublicAccess) {
      setMe(null);
      setBoardOwnerId(null);
      setCurrentChannelId(null);
      setIsOpen(false);
      clearAllUnread();
      window.dispatchEvent(new CustomEvent('chat-reset'));
    }
  }, [isOnPublicBoard, publicBoardUser?.id, hasPublicAccess, clearAllUnread]);

  // Enhanced notifications - request permission immediately
  const { requestPermission, showNotification } = useEnhancedNotifications();

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
      // Increment unread count for channel with message timestamp
      incrementUnread(message.channel_id, message.created_at);

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
  }, [boardOwnerId, me, isOpen, currentChannelId, incrementUnread, showNotification]);

  // Real-time setup - FIXED: enable for both admin and authenticated public board users
  const realtimeEnabled = shouldShowChat && isInitialized && !!boardOwnerId && !!me?.id;
  const { connectionStatus } = useEnhancedRealtimeChat({
    onNewMessage: handleNewMessage,
    userId: me?.id,
    boardOwnerId: boardOwnerId || undefined,
    // Enable real-time for authenticated users, disable for public board access only
    enabled: realtimeEnabled,
  });

  // Track default channel for public boards (so we can poll something when closed)
  const [defaultChannelId, setDefaultChannelId] = useState<string | null>(null);
  useEffect(() => {
    if (!boardOwnerId) return;
    
    console.log('🔍 Fetching default channel for board owner:', boardOwnerId);
    supabase.rpc('get_default_channel_for_board', { p_board_owner_id: boardOwnerId })
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ Error fetching default channel:', error);
        } else if (data?.[0]?.id) {
          console.log('✅ Found default channel:', data[0].id, 'name:', data[0].name);
          setDefaultChannelId(data[0].id as string);
        } else {
          console.log('⚠️ No default channel found for board owner:', boardOwnerId);
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

  const openChannel = useCallback((channelId: string) => {
    setCurrentChannelId(channelId);
    clearChannelUnread(channelId);
    setIsOpen(true);
  }, [clearChannelUnread]);

  // Initialize user identity and board owner - DETERMINISTIC for sub-users
  useEffect(() => {
    let active = true;

    (async () => {
      setIsInitialized(false);

      // Resolve board owner from slug
      const slug = location.pathname.split('/').pop()!;
      const { data: pb } = await supabase.from('public_boards')
        .select('user_id').eq('slug', slug).maybeSingle();
      const ownerId = pb?.user_id || null;
      if (active) setBoardOwnerId(ownerId);

      // PUBLIC BOARD: identity from PublicBoardAuth OR localStorage
      const { hasAccess, email: lsEmail, fullName: lsName, storedOwnerId } = getPublicAccess(location.pathname);

      if (isOnPublicBoard && ownerId) {
        if (publicBoardUser?.id) {
          // Fast path: authenticated sub-user
          const email = publicBoardUser.email?.trim().toLowerCase();
          let suId: string | null = null;
          if (email) {
            const { data: su } = await supabase.from('sub_users')
              .select('id, fullname, avatar_url').eq('board_owner_id', ownerId)
              .ilike('email', email).maybeSingle();
            suId = su?.id || null;
          }
          if (active) {
            setMe({
              id: suId || publicBoardUser.id,
              type: 'sub_user',
              name: publicBoardUser.fullName || publicBoardUser.email?.split('@')[0] || 'Member',
              email: publicBoardUser.email || undefined,
              avatarUrl: undefined,
            });
            setIsInitialized(true);           // ← important
          }
          return;
        }

        if (hasAccess && storedOwnerId === ownerId) {
          // Fallback: LS token user
          let suId: string | null = null;
          if (lsEmail) {
            const { data: su } = await supabase.from('sub_users')
              .select('id, fullname, avatar_url').eq('board_owner_id', ownerId)
              .ilike('email', lsEmail.trim().toLowerCase()).maybeSingle();
            suId = su?.id || null;
          }
          if (active) {
            setMe({
              id: suId || `temp-${ownerId}`,   // temporary id if row not found yet
              type: 'sub_user',
              name: lsName || (lsEmail?.split('@')[0] ?? 'Member'),
              email: lsEmail,
              avatarUrl: undefined,
            });
            setIsInitialized(true);           // ← important
          }
          return;
        }
      }

      // INTERNAL dashboard (admin) — unchanged
      if (!isOnPublicBoard && user?.id) {
        const { data: profile } = await supabase
          .from('profiles').select('id, username, avatar_url').eq('id', user.id).maybeSingle();
        if (active) {
          setBoardOwnerId(user.id);
          setMe({
            id: user.id,
            type: 'admin',
            name: profile?.username?.startsWith('user_')
              ? (user.email?.split('@')[0] || 'Admin')
              : (profile?.username || 'Admin'),
            email: user.email || undefined,
            avatarUrl: resolveAvatarUrl(profile?.avatar_url),
          });
          setIsInitialized(true);
        }
        return;
      }

      if (active) {
        setMe(null);
        setIsInitialized(true);
      }
    })();

    return () => { active = false; };
  }, [isOnPublicBoard, publicBoardUser?.id, publicBoardUser?.email, user?.id, location.pathname, hasPublicAccess]);

  // ❌ REMOVED: Old normalization logic is no longer needed since the migration handles it

  // Map DM channels to their members for unread tracking
  useEffect(() => {
    if (!boardOwnerId || !me) return;

    console.log('🔄 Building channel-member mapping...');
    
    (async () => {
      try {
        const newChannelMemberMap = new Map();

        // Admin path (unchanged)
        if (me.type === 'admin') {
          const { data: dmChannels } = await supabase
            .from('chat_channels')
            .select(`
              id,
              is_dm,
              chat_participants(user_id, sub_user_id, user_type)
            `)
            .eq('owner_id', boardOwnerId)
            .eq('is_dm', true);

          if (dmChannels) {
            dmChannels.forEach((channel: any) => {
              const participants = channel.chat_participants || [];
              
              // For DMs, find the OTHER participant (not me)
              if (participants.length === 2) {
                const myId = me.id;
                const myType = me.type;
                
                const otherParticipant = participants.find((p: any) => {
                  // Skip if this is me
                  if (myType === 'admin' && p.user_type === 'admin' && p.user_id === myId) return false;
                  if (myType === 'sub_user' && p.user_type === 'sub_user' && p.sub_user_id === myId) return false;
                  return true;
                });

                if (otherParticipant) {
                  const memberId = otherParticipant.user_id || otherParticipant.sub_user_id;
                  const memberType = otherParticipant.user_type as 'admin' | 'sub_user';
                  
                  if (memberId && memberType) {
                    console.log(`✅ Mapped DM channel ${channel.id} to member:`, { memberId, memberType });
                    newChannelMemberMap.set(channel.id, { 
                      id: memberId, 
                      type: memberType 
                    });
                  }
                }
              }
            });
          }
        } else {
          // Sub-user path via RLS-safe RPC
          const { data, error } = await supabase.rpc('get_dm_channels_for_sub_user', {
            p_owner_id: boardOwnerId,
            p_email: me.email
          });

          if (!error && data) {
            data.forEach((row: any) => {
              const memberId = row.other_user_id || row.other_sub_user_id;
              const memberType = row.other_type as 'admin' | 'sub_user';
              
              if (memberId && memberType) {
                console.log(`✅ Mapped DM channel ${row.channel_id} to member:`, { memberId, memberType });
                newChannelMemberMap.set(row.channel_id, { 
                  id: memberId, 
                  type: memberType 
                });
              }
            });
          } else if (error) {
            console.error('❌ Error fetching DM channels for sub-user:', error);
          }
        }
        
        console.log('🗺️ Final channel-member map:', Array.from(newChannelMemberMap.entries()));
        setChannelMemberMap(newChannelMemberMap);
      } catch (error) {
        console.error('❌ Error building channel-member mapping:', error);
      }
    })();
  }, [boardOwnerId, me]);

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

      // Clear unread count for this user before opening DM
      clearUserUnread(otherId, otherType);

      // Single canonical path for both dashboard and public boards
      const { data: channelId, error } = await supabase.rpc('find_or_create_dm', {
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

      console.log('✅ Canonical DM channel created/found:', channelId);
      setCurrentChannelId(channelId as string);
      setIsOpen(true);

    } catch (error: any) {
      console.error('❌ Error in startDM:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start direct message',
        variant: 'destructive',
      });
    }
  }, [boardOwnerId, me, toast, clearUserUnread]);

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
    unreadTotal,
    channelUnreads,
    getUserUnreadCount,
    channelMemberMap,
    boardOwnerId,
    connectionStatus,
    realtimeEnabled,
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers, me, currentChannelId, openChannel, startDM, unreadTotal, channelUnreads, getUserUnreadCount, channelMemberMap, boardOwnerId, connectionStatus, realtimeEnabled]);

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