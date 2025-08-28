import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
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
};

const ChatContext = createContext<ChatCtx | null>(null);

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
};

export const ChatProvider: React.FC = () => {
  const { user } = useAuth();
  const { user: publicBoardUser, isPublicBoard } = usePublicBoardAuth();
  const location = useLocation();
  const { toast } = useToast();
  
  // Determine effective user and board owner
  const effectiveUser = isPublicBoard ? publicBoardUser : user;
  const isOnPublicBoard = location.pathname.startsWith('/board/');
  const isOnDashboard = location.pathname.includes('/dashboard');
  
  // Should we show chat at all?
  const shouldShowChat = useMemo(() => {
    // Show on dashboard when user is present
    if (isOnDashboard && user) {
      console.log('✅ Dashboard + user -> show chat');
      return true;
    }
    
    // Show on public board (even without user, for external access)
    if (isOnPublicBoard) {
      console.log('✅ Public board -> show chat');
      return true;
    }
    
    console.log('❌ No conditions met -> hide chat', { isOnDashboard, isOnPublicBoard, hasUser: !!user });
    return false;
  }, [location.pathname, user, isOnDashboard, isOnPublicBoard]);

  // UI state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasSubUsers, setHasSubUsers] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [boardOwnerId, setBoardOwnerId] = useState<string | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);

  // Enhanced unread management
  const {
    unreadTotal,
    channelUnreads,
    incrementUnread,
    clearChannelUnread,
    clearAllUnread,
  } = useUnreadManager(currentChannelId, isOpen);

  // Enhanced notifications
  const { requestPermission, showNotification } = useEnhancedNotifications();

  // Enhanced realtime connection
  const { connectionStatus } = useEnhancedRealtimeChat({
    onNewMessage: (message) => {
      console.log('📨 Enhanced realtime message received:', message);

      // Only process messages for this board
      if (message.owner_id !== boardOwnerId) {
        console.log('⏭️ Skipping message - owner mismatch');
        return;
      }

      // Enhanced message ownership detection
      const isMine = (
        (me?.type === 'admin' && message.sender_type === 'admin' && message.sender_user_id === me?.id) ||
        (me?.type === 'sub_user' && message.sender_type === 'sub_user' && message.sender_sub_user_id === me?.id)
      );

      const isActiveChannel = (message.channel_id === currentChannelId);
      const shouldCount = !isMine && (!isActiveChannel || !isOpen);
      const shouldNotify = !isMine && (!isOpen || !isActiveChannel);

      console.log('🔍 Enhanced message processing:', {
        isMine,
        isActiveChannel,
        shouldCount,
        shouldNotify,
        connectionStatus,
      });

      // Update unread counts
      if (shouldCount) {
        incrementUnread(message.channel_id);
      }

      // Show enhanced notifications with voice
      if (shouldNotify) {
        showNotification({
          title: message.sender_name || 'New message',
          body: String(message.content || '').slice(0, 120),
          channelId: message.channel_id,
          senderId: message.sender_user_id || message.sender_sub_user_id || 'unknown',
          senderName: message.sender_name || 'Unknown',
        });
      }
    },
    userId: me?.id,
    boardOwnerId: boardOwnerId,
    enabled: !!me && !!boardOwnerId && shouldShowChat,
  });

  // Create portal root
  const portalRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let node = document.getElementById("chat-root") as HTMLElement | null;
    if (!node) {
      node = document.createElement("div");
      node.id = "chat-root";
      node.style.position = "fixed";
      node.style.inset = "0";
      node.style.pointerEvents = "none";
      node.style.zIndex = "2147483647";
      document.body.appendChild(node);
    }
    portalRef.current = node;
  }, []);

  // Chat controls
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  // Initialize user identity and board owner
  useEffect(() => {
    let active = true;
    
    (async () => {
      console.log('🔍 Initializing chat for:', { 
        user: user?.email, 
        userId: user?.id,
        isPublicBoard, 
        shouldShowChat, 
        path: location.pathname,
        isOnPublicBoard,
        effectiveUser: effectiveUser?.email,
        publicBoardUser: publicBoardUser?.email
      });
      
      if (!shouldShowChat) {
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          setIsInitialized(true);
        }
        return;
      }

      try {
        // Handle PUBLIC BOARD ACCESS FIRST (including authenticated sub-users on public boards)
        if (isOnPublicBoard) {
          console.log('🔍 Public board access detected');
          
          const pathParts = location.pathname.split('/');
          const slug = pathParts[pathParts.length - 1];
          
          // Check if we have local storage access data for this board
          const storedData = localStorage.getItem(`public-board-access-${slug}`);
          if (storedData) {
            try {
              const parsedData = JSON.parse(storedData);
              const { token, fullName: storedFullName, email: storedEmail, boardOwnerId: storedBoardOwnerId } = parsedData;
              
              console.log('🔍 PUBLIC BOARD: Parsing stored access data:', { 
                hasToken: !!token,
                storedFullName, 
                storedEmail,
                storedBoardOwnerId 
              });
              
              if (token && storedFullName && storedBoardOwnerId && storedEmail) {
                console.log('✅ Found stored public board access - searching for sub-user record');
                
                // Enhanced sub-user lookup with multiple strategies
                console.log('🔍 Strategy 1: Exact email match');
                let { data: subUser, error: subUserError } = await supabase
                  .from("sub_users")
                  .select("id, fullname, avatar_url, email")
                  .eq("board_owner_id", storedBoardOwnerId)
                  .ilike("email", storedEmail.trim().toLowerCase())
                  .maybeSingle();
                
                if (subUserError) {
                  console.error('❌ Strategy 1 error:', subUserError);
                }
                
                // Strategy 2: If no exact match, try searching by name
                if (!subUser?.id) {
                  console.log('🔍 Strategy 2: Searching by name');
                  const { data: nameMatch } = await supabase
                    .from("sub_users")
                    .select("id, fullname, avatar_url, email")
                    .eq("board_owner_id", storedBoardOwnerId)
                    .ilike("fullname", storedFullName.trim())
                    .maybeSingle();
                  
                  if (nameMatch?.id) {
                    console.log('✅ Found sub-user by name match:', nameMatch);
                    subUser = nameMatch;
                  }
                }
                
                // Strategy 3: List all sub-users for this board to debug
                if (!subUser?.id) {
                  console.log('🔍 Strategy 3: Debugging - listing all sub-users for board');
                  const { data: allSubUsers } = await supabase
                    .from("sub_users")
                    .select("id, fullname, avatar_url, email")
                    .eq("board_owner_id", storedBoardOwnerId);
                  
                  console.log('🔍 All sub-users for board:', allSubUsers?.map(u => ({
                    id: u.id,
                    email: u.email,
                    fullname: u.fullname,
                    emailMatch: u.email?.toLowerCase() === storedEmail.toLowerCase(),
                    nameMatch: u.fullname?.toLowerCase() === storedFullName.toLowerCase()
                  })));
                  
                  // Try to find any matching user from the list
                  const potentialMatch = allSubUsers?.find(u => 
                    u.email?.toLowerCase().includes(storedEmail.toLowerCase()) ||
                    u.fullname?.toLowerCase().includes(storedFullName.toLowerCase()) ||
                    storedEmail.toLowerCase().includes(u.email?.toLowerCase() || '') ||
                    storedFullName.toLowerCase().includes(u.fullname?.toLowerCase() || '')
                  );
                  
                  if (potentialMatch) {
                    console.log('✅ Found potential match via fuzzy search:', potentialMatch);
                    subUser = potentialMatch;
                  }
                }
                
                if (subUser?.id) {
                  console.log('✅ SUCCESS: Found sub-user record for PUBLIC BOARD:', { 
                    id: subUser.id, 
                    name: subUser.fullname,
                    email: subUser.email,
                    avatarUrl: subUser.avatar_url,
                    boardOwnerId: storedBoardOwnerId 
                  });
                  
                  const subUserIdentity = {
                    id: subUser.id,
                    type: "sub_user" as const, 
                    name: subUser.fullname || storedFullName,
                    email: storedEmail,
                    avatarUrl: resolveAvatarUrl(subUser.avatar_url)
                  };
                  
                  console.log('🔧 Creating sub-user identity for PUBLIC BOARD:', subUserIdentity);
                  
                  if (active) {
                    setBoardOwnerId(storedBoardOwnerId);
                    setMe(subUserIdentity);
                    setIsInitialized(true);
                    console.log('🎉 PUBLIC BOARD: Chat initialized for sub-user with identity:', subUserIdentity);
                  }
                  return;
                } else {
                  console.log('❌ FAILED: Sub-user record not found in database');
                  console.log('💡 Searched for email:', storedEmail, 'and name:', storedFullName);
                  console.log('💡 Chat functionality requires a valid sub-user database record');
                  
                  // Initialize without chat functionality
                  if (active) {
                    setBoardOwnerId(storedBoardOwnerId);
                    setMe(null); // No chat access without database record
                    setIsInitialized(true);
                  }
                  return;
                }
              }
            } catch (error) {
              console.error('❌ Error parsing stored access data:', error);
            }
          }
          
          console.log('⚠️ No valid public board access found');
        }
        
        // Handle authenticated users (admin and sub-users) - FIXED
        if (user?.id) {
          console.log('🔍 Checking authenticated user:', { 
            email: user.email, 
            userId: user.id 
          });
          
          // Try admin first - check profiles table
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
          
          console.log('🔍 Profile query result:', { 
            profile, 
            profileError: profileError?.message,
            hasProfile: !!profile 
          });
          
          if (active && profile) {
            console.log('✅ Admin user detected:', profile.username);
            
            // Use email local part if username is auto-generated
            const displayName = profile.username?.startsWith('user_') 
              ? (user.email?.split('@')[0] || 'Admin')
              : (profile.username || 'Admin');
            
            setBoardOwnerId(user.id);
            setMe({
              id: profile.id,
              type: "admin",
              name: displayName,
              email: user.email || undefined,
              avatarUrl: resolveAvatarUrl(profile.avatar_url)
            });
            setIsInitialized(true);
            return;
          }
          
          // Try sub-user by email match (case-insensitive)
          const userEmail = user.email?.toLowerCase();
          if (userEmail) {
            console.log('🔍 Looking for sub-user with email:', userEmail);
            
            const { data: subUser, error: subUserError } = await supabase
              .from("sub_users")
              .select("*")
              .ilike("email", userEmail)
              .maybeSingle();

            if (subUserError) {
              console.log('⚠️ Sub-user query error:', subUserError);
            }

            if (active && subUser) {
              console.log('✅ Sub-user detected:', { 
                id: subUser.id,
                fullname: subUser.fullname, 
                boardOwnerId: subUser.board_owner_id 
              });
              
              setBoardOwnerId(subUser.board_owner_id);
              setMe({
                id: subUser.id,
                type: "sub_user",
                name: subUser.fullname || "Member",
                email: subUser.email,
                avatarUrl: resolveAvatarUrl(subUser.avatar_url)
              });
              setIsInitialized(true);
              return;
            }
          }
          
          console.log('❌ Authenticated user not found in profiles or sub_users');
        }
        
        // No valid user found
        console.log('❌ No valid user identity found');
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          setIsInitialized(true);
        }
        
      } catch (error) {
        console.error('❌ Error initializing chat:', error);
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          setIsInitialized(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id, user?.email, shouldShowChat, location.pathname, isOnPublicBoard]);

  // (One-time) normalize old DM rows on the fly
  useEffect(() => {
    if (!boardOwnerId) return;
    (async () => {
      const { data: chans } = await supabase
        .from('chat_channels')
        .select('id, is_dm, participants, chat_participants(user_id, sub_user_id)')
        .eq('owner_id', boardOwnerId);

      for (const ch of (chans || [])) {
        const cps = (ch.chat_participants || []) as any[];
        const hasOwner = cps.some(p => p.user_id === boardOwnerId);
        if (!hasOwner) await supabase.from('chat_participants')
          .insert({ channel_id: ch.id, user_id: boardOwnerId, user_type: 'admin' })
          .then(() => {});
        if (cps.length === 2 && ch.is_dm !== true) {
          await supabase.from('chat_channels').update({ is_dm: true, is_private: true }).eq('id', ch.id);
        }
        if (!Array.isArray(ch.participants) || ch.participants.length < 2) {
          const otherId = (cps.find(p => p.user_id && p.user_id !== boardOwnerId)?.user_id) ||
                          (cps.find(p => p.sub_user_id)?.sub_user_id);
          if (otherId) await supabase.from('chat_channels')
            .update({ participants: [boardOwnerId, otherId] }).eq('id', ch.id);
        }
      }
    })();
  }, [boardOwnerId]);

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

  // Channel management
  const openChannel = useCallback((id: string) => {
    console.log('📂 Opening channel:', id);
    setCurrentChannelId(id);
    clearChannelUnread(id);
  }, [clearChannelUnread]);

  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!me || !boardOwnerId) return;

    // 1) fetch all DM candidates for this owner with their participants
    const { data: candidates, error: candErr } = await supabase
      .from("chat_channels")
      .select(`
        id, is_dm, created_at, updated_at,
        chat_participants ( user_id, sub_user_id, user_type )
      `)
      .eq("owner_id", boardOwnerId)
      .eq("is_dm", true);

    if (candErr) { console.error(candErr); return; }

    // 2) reuse the one that has BOTH the owner and the other participant
    const matches = (candidates || []).filter(c => {
      const cps = (c.chat_participants || []) as any[];
      const hasOwner = cps.some(p => p.user_id === boardOwnerId);
      const hasOther = otherType === "admin"
        ? cps.some(p => p.user_id === otherId)
        : cps.some(p => p.sub_user_id === otherId);
      return hasOwner && hasOther;
    });

    let channelId = matches.sort((a, b) =>
      new Date(b.updated_at || b.created_at).getTime() -
      new Date(a.updated_at || a.created_at).getTime()
    )[0]?.id;

    // 3) if none, create one
    if (!channelId) {
      const { data: created, error: createErr } = await supabase
        .from("chat_channels")
        .insert({
          name: "Direct Message",
          owner_id: boardOwnerId,
          is_dm: true,
          is_private: true,
          participants: [boardOwnerId, otherId], // keep JSON for legacy readers
        })
        .select("id")
        .single();
      if (createErr || !created) { console.error(createErr); return; }
      channelId = created.id;
    }

    // 4) ensure BOTH participant rows exist (idempotent)
    await supabase.from("chat_participants").upsert([
      { channel_id: channelId, user_id: boardOwnerId, user_type: "admin" },
      {
        channel_id: channelId,
        user_id:   otherType === "admin"    ? otherId : null,
        sub_user_id: otherType === "sub_user" ? otherId : null,
        user_type: otherType
      }
    ], { onConflict: "channel_id,user_id,sub_user_id" });

    // 5) normalize JSON field too (compat)
    await supabase.from("chat_channels")
      .update({ participants: [boardOwnerId, otherId], is_dm: true, is_private: true })
      .eq("id", channelId);

    openChannel(channelId);
    if (!isOpen) open();
  }, [me, boardOwnerId, openChannel, isOpen, open]);

  // Request notification permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const value = useMemo<ChatCtx>(() => ({
    isOpen, open, close, toggle, isInitialized, hasSubUsers, me,
    currentChannelId, setCurrentChannelId, openChannel, startDM, 
    unreadTotal, channelUnreads, boardOwnerId
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers, me, 
       currentChannelId, openChannel, startDM, unreadTotal, channelUnreads, boardOwnerId]);

  if (!shouldShowChat || !portalRef.current) return null;

  console.log('🔍 ChatProvider render:', { 
    hasSubUsers, isInitialized, hasUser: !!user?.id, shouldShowChat,
    me, boardOwnerId
  });

  return (
    <ChatContext.Provider value={value}>
      {createPortal(
        <>
          {isInitialized && !isOpen && (
            <div style={{ pointerEvents: "auto" }}>
              <ChatIcon onClick={toggle} isOpen={isOpen} unreadCount={unreadTotal} />
            </div>
          )}

          {isOpen && (
            <div style={{ pointerEvents: "auto" }}>
              <ChatWindow isOpen={isOpen} onClose={close} />
            </div>
          )}
        </>,
        portalRef.current
      )}
    </ChatContext.Provider>
  );
};