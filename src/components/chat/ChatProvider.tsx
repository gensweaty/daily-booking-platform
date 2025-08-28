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

type Me = { id: string; type: "admin" | "sub_user"; name: string; avatarUrl?: string };

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
  const [unreadTotal, setUnreadTotal] = useState(0);

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
      console.log('🔍 Initializing chat for:', { effectiveUser, isPublicBoard, shouldShowChat });
      
      if (!shouldShowChat) {
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          setIsInitialized(true);
        }
        return;
      }

      try {
        // Handle public board access (external users)
        if (isOnPublicBoard && !user) {
          const pathParts = location.pathname.split('/');
          const accessToken = pathParts[pathParts.length - 1];
          
          if (accessToken) {
            const { data: boardAccess } = await supabase
              .from('public_board_access')
              .select('external_user_name, external_user_email, board_id')
              .eq('access_token', accessToken)
              .maybeSingle();
            
            if (active && boardAccess) {
              const { data: publicBoard } = await supabase
                .from('public_boards')
                .select('user_id')
                .eq('id', boardAccess.board_id)
                .maybeSingle();
                
              if (publicBoard) {
                console.log('🎯 External user on public board:', boardAccess);
                setBoardOwnerId(publicBoard.user_id);
                setMe({
                  id: `external_${accessToken}`,
                  type: "sub_user",
                  name: boardAccess.external_user_name || "Guest",
                  avatarUrl: null
                });
                setIsInitialized(true);
                return;
              }
            }
          }
          
          // Fallback for external access
          if (active) {
            console.log('🎯 Fallback external user');
            setMe({
              id: `guest_${Date.now()}`,
              type: "sub_user",
              name: "Guest User",
              avatarUrl: null
            });
            setIsInitialized(true);
          }
          return;
        }
        
        // Handle authenticated users
        if (!user?.id) {
          if (active) {
            setMe(null);
            setBoardOwnerId(null);
            setIsInitialized(true);
          }
          return;
        }

        // Try admin first
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        
        if (active && profile) {
          console.log('🎯 Admin user detected:', profile);
          setBoardOwnerId(user.id);
          setMe({
            id: profile.id,
            type: "admin",
            name: profile.username || "Admin",
            avatarUrl: resolveAvatarUrl(profile.avatar_url)
          });
          setIsInitialized(true);
          return;
        }
        
        // Try sub-user by email
        const userEmail = user.email?.toLowerCase();
        if (!userEmail) {
          console.log('❌ No user email found');
          if (active) {
            setMe(null);
            setBoardOwnerId(null);
            setIsInitialized(true);
          }
          return;
        }

        const { data: subUser } = await supabase
          .from("sub_users")
          .select("*")
          .filter("email", "ilike", userEmail)
          .maybeSingle();

        if (active && subUser) {
          console.log('🎯 Sub-user detected:', subUser);
          setBoardOwnerId(subUser.board_owner_id);
          setMe({
            id: subUser.id,
            type: "sub_user",
            name: subUser.fullname || "Member",
            avatarUrl: resolveAvatarUrl(subUser.avatar_url)
          });
          setIsInitialized(true);
        } else {
          console.log('❌ No matching user found');
          if (active) {
            setMe(null);
            setBoardOwnerId(null);
            setIsInitialized(true);
          }
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
  }, [user?.id, shouldShowChat, location.pathname, isOnPublicBoard, effectiveUser]);

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
    setUnreadTotal(0);
  }, []);

  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!me || !boardOwnerId) {
      console.log('❌ Missing me or boardOwnerId for DM:', { me, boardOwnerId });
      return;
    }
    
    console.log('🚀 Starting DM with:', { otherId, otherType, me, boardOwnerId });
    
    try {
      // Simple DM name
      const dmName = `DM: ${me.name} & ${otherType === 'admin' ? 'Admin' : 'Member'}`;

      // Look for existing DM channel
      const { data: existing } = await supabase
        .from("chat_channels")
        .select("id, participants")
        .eq("is_dm", true)
        .eq("owner_id", boardOwnerId);

      // Find existing DM with these participants
      let channelId = existing?.find(ch => {
        const participants = ch.participants as string[];
        return participants?.includes(me.id) && participants?.includes(otherId);
      })?.id;
      
      if (!channelId) {
        console.log('🆕 Creating new DM channel');
        const { data: created, error } = await supabase
          .from("chat_channels")
          .insert({
            is_dm: true,
            participants: [me.id, otherId],
            name: dmName,
            owner_id: boardOwnerId
          })
          .select("id")
          .single();
        
        if (error) {
          console.error('❌ Error creating DM channel:', error);
          toast({
            title: "Error",
            description: "Failed to start direct message",
            variant: "destructive"
          });
          return;
        }
        
        // Create participant entries
        if (created?.id) {
          await supabase.from("chat_participants").insert([
            {
              channel_id: created.id,
              user_id: me.type === 'admin' ? me.id : null,
              sub_user_id: me.type === 'sub_user' ? me.id : null,
              user_type: me.type
            },
            {
              channel_id: created.id,
              user_id: otherType === 'admin' ? otherId : null,
              sub_user_id: otherType === 'sub_user' ? otherId : null,
              user_type: otherType
            }
          ]);
        }
        
        channelId = created?.id;
        console.log('✅ New DM channel created:', channelId);
      }

      if (channelId) {
        openChannel(channelId);
        if (!isOpen) open();
      }
    } catch (error) {
      console.error('❌ Failed to start DM:', error);
      toast({
        title: "Error",
        description: "Failed to start direct message",
        variant: "destructive"
      });
    }
  }, [me, boardOwnerId, openChannel, isOpen, open, toast]);

  // Notifications
  useEffect(() => {
    if (!me || !boardOwnerId || !shouldShowChat) return;

    console.log('🔔 Setting up notifications for:', me);

    const ch = supabase
      .channel('chat_notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as any;
          console.log('📨 New message:', msg);

          // Only process messages for this board
          if (msg.owner_id !== boardOwnerId) {
            console.log('⏭️ Skipping - wrong board owner');
            return;
          }

          // Check if it's my message
          const isMine = (
            (msg.sender_user_id && me.id === msg.sender_user_id && msg.sender_type === 'admin') ||
            (msg.sender_sub_user_id && me.id === msg.sender_sub_user_id && msg.sender_type === 'sub_user') ||
            (me.id.startsWith('external_') || me.id.startsWith('guest_')) && 
            (msg.sender_name === me.name)
          );
          
          const isActiveChannel = msg.channel_id === currentChannelId;
          const shouldCount = !isMine && (!isActiveChannel || !isOpen);
          const shouldNotify = !isMine && (!isOpen || !isActiveChannel);

          console.log('🔍 Message check:', { isMine, isActiveChannel, shouldCount, shouldNotify });

          if (shouldCount) {
            setUnreadTotal(prev => prev + 1);
          }

          if (shouldNotify && "Notification" in window && Notification.permission === "granted") {
            new Notification(msg.sender_name || "New message", { 
              body: String(msg.content || '').slice(0, 120),
              icon: '/favicon.ico'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, boardOwnerId, currentChannelId, isOpen, shouldShowChat]);

  // Reset unread on open/channel change
  useEffect(() => {
    if (isOpen || currentChannelId) {
      setUnreadTotal(0);
    }
  }, [isOpen, currentChannelId]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const value = useMemo<ChatCtx>(() => ({
    isOpen, open, close, toggle, isInitialized, hasSubUsers, me,
    currentChannelId, setCurrentChannelId, openChannel, startDM, 
    unreadTotal, boardOwnerId
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers, me, 
       currentChannelId, openChannel, startDM, unreadTotal, boardOwnerId]);

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