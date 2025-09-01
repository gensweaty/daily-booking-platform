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

  // Determine if chat should be shown - FIXED: Only show after sub-user is authenticated
  const shouldShowChat = useMemo(() => {
    // Public board => only after sub-user is authenticated
    if (isOnPublicBoard) return !!publicBoardUser?.id;
    // Internal dashboard => only for authenticated admins
    return !!user?.id;
  }, [isOnPublicBoard, publicBoardUser?.id, user?.id]);

  console.log('🔍 ChatProvider render:', {
    hasSubUsers,
    isInitialized,
    hasUser: !!user,
    shouldShowChat,
    me,
    boardOwnerId
  });

  // Enhanced unread management - memoized dependencies
  const {
    unreadTotal,
    channelUnreads,
    incrementUnread,
    clearChannelUnread,
    clearAllUnread,
  } = useUnreadManager(currentChannelId, isOpen);

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

  // Real-time setup - FIXED: enable for authenticated users regardless of route
  const realtimeEnabled = shouldShowChat && isInitialized && !!boardOwnerId && !!user?.id;
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

      // 1) Resolve board owner from slug always
      const slug = location.pathname.split('/').pop()!;
      const { data: pb } = await supabase
        .from('public_boards')
        .select('user_id')
        .eq('slug', slug)
        .maybeSingle();

      const ownerId = pb?.user_id || null;
      if (active) setBoardOwnerId(ownerId);

      // 2) PUBLIC BOARD: if sub-user is logged in via PublicBoardAuth, use that identity immediately
      if (isOnPublicBoard && publicBoardUser?.id && ownerId) {
        // try to resolve the sub_user row to get the id (nice to have, not strictly required to load msgs)
        const email = publicBoardUser.email?.trim().toLowerCase();
        let subUserId: string | null = null;
        if (email) {
          const { data: su } = await supabase
            .from('sub_users')
            .select('id, fullname, avatar_url, email')
            .eq('board_owner_id', ownerId)
            .ilike('email', email)
            .maybeSingle();
          subUserId = su?.id || null;
        }

        const meCandidate: Me = {
          id: subUserId || publicBoardUser.id, // fall back to auth id if DB row not found yet
          type: 'sub_user',
          name: publicBoardUser.fullName || publicBoardUser.email?.split('@')[0] || 'Member',
          email: publicBoardUser.email || undefined,
          avatarUrl: undefined,
        };

        if (active) {
          setMe(meCandidate);
          setIsInitialized(true); // ← do not delay; ChatArea will fetch messages right away
        }

        // Also preselect default channel as soon as owner is known
        if (ownerId) {
          const { data } = await supabase.rpc('get_default_channel_for_board', { p_board_owner_id: ownerId });
          const id = data?.[0]?.id as string | undefined;
          if (active && id && !currentChannelId) setCurrentChannelId(id);
        }

        return;
      }

      // 3) INTERNAL DASHBOARD (admin)
      if (!isOnPublicBoard && user?.id) {
        if (active) {
          setBoardOwnerId(user.id);
          const { data: profile } = await supabase
            .from('profiles').select('id, username, avatar_url').eq('id', user.id).maybeSingle();

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

      // 4) Fallback: no identity (icon won't be visible anyway due to shouldShowChat)
      if (active) {
        setMe(null);
        setIsInitialized(true);
      }
    })();

    return () => { active = false; };
  }, [isOnPublicBoard, publicBoardUser?.id, publicBoardUser?.email, user?.id, location.pathname, currentChannelId]);

  // ❌ REMOVED: Old normalization logic is no longer needed since the migration handles it

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

  // C.5 Replace both DM creators with the canonical RPC
  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!boardOwnerId || !me) {
      console.log('❌ Cannot start DM - missing prerequisites');
      return;
    }

    try {
      console.log('🔍 Using canonical find_or_create_dm RPC for:', { me, otherId, otherType });

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
  }, [boardOwnerId, me, toast]);

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
    boardOwnerId,
    connectionStatus,
    realtimeEnabled,
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers, me, currentChannelId, openChannel, startDM, unreadTotal, channelUnreads, boardOwnerId, connectionStatus, realtimeEnabled]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
      {shouldShowChat && portalRoot && createPortal(
        <>
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
        </>,
        portalRoot
      )}
    </ChatContext.Provider>
  );
};