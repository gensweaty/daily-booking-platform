import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChatIcon } from "./ChatIcon";
import { ChatWindow } from "./ChatWindow";
import { resolveAvatarUrl } from "./_avatar";

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
};

const ChatContext = createContext<ChatCtx | null>(null);

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
};

export const ChatProvider: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Only show chat on dashboard routes when user is authenticated
  const { loading } = useAuth();
  // Should we show chat at all?
  const shouldShowChat = useMemo(() => {
    // Always show on dashboard or public board routes  
    const isOnPublicBoard = location.pathname.startsWith('/board/');
    const isOnDashboard = location.pathname.includes('/dashboard');
    const hasUser = !!user;
    
    console.log('🤔 Should show chat?', { isOnDashboard, isOnPublicBoard, hasUser, path: location.pathname });
    
    // Show on dashboard when user is present
    if (isOnDashboard && hasUser) {
      console.log('✅ Dashboard + user -> show chat');
      return true;
    }
    
    // Show on public board (even without user, for external access)
    if (isOnPublicBoard) {
      console.log('✅ Public board -> show chat');
      return true;
    }
    
    console.log('❌ No conditions met -> hide chat');
    return false;
  }, [location.pathname, user]);

  // UI state - ALWAYS start closed
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasSubUsers, setHasSubUsers] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Make one portal root for chat
  const portalRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let node = document.getElementById("chat-root") as HTMLElement | null;
    if (!node) {
      node = document.createElement("div");
      node.id = "chat-root";
      node.style.position = "fixed";
      node.style.inset = "0";
      node.style.pointerEvents = "none"; // let only chat elements opt-in to pointer events
      node.style.zIndex = "2147483647";  // max z
      document.body.appendChild(node);
    }
    portalRef.current = node;
  }, []);

  // Persist UI state so a page change keeps your window state
  useEffect(() => {
    localStorage.setItem("chat_isOpen", String(isOpen));
  }, [isOpen]);

  // Public toggles
  const open = useCallback(() => {
    console.log("💬 ChatProvider.open()");
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    console.log("💬 ChatProvider.close()");
    setIsOpen(false);
  }, []);
  const toggle = useCallback(() => {
    console.log("💬 ChatProvider.toggle()");
    setIsOpen(prev => !prev);
  }, []);

  // Simple, non-invasive check to decide if icon should show.
  // Adjust query to match your sub-user table if needed.
  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsInitialized(false);
      if (!user?.id) {
        // On public boards, still allow chat even without authenticated user
        const isOnPublicBoard = location.pathname.startsWith('/board/');
        if (isOnPublicBoard) {
          console.log('📋 Public board - allowing chat without user');
          if (active) {
            setHasSubUsers(false);
            setIsInitialized(true);
          }
          return;
        }
        
        console.log("👤 No user -> hide chat");
        if (active) {
          setHasSubUsers(false);
          setIsInitialized(true);
        }
        return;
      }

        try {
          let has = true; // don't gate visibility by sub-users anymore
          
          // Still try to load sub-users for hasSubUsers state
          try {
            const { data, error } = await supabase
              .from("sub_users")
              .select("id")
              .eq("board_owner_id", user.id)
              .limit(1);
            if (error) console.log("ℹ️ sub_users probe:", error.message);
            if (data?.length) setHasSubUsers(true);
          } catch (e) {
            console.log("ℹ️ sub_users probe failed (table may not exist)");
          }

          if (active) {
            setHasSubUsers(has);
            setIsInitialized(true);
            console.log("✅ Chat init:", { userId: user.id, hasSubUsers: has, shouldShowChat });
          }
      } catch (e) {
        console.log("⚠️ Chat init error:", e);
        if (active) {
          setHasSubUsers(false);
          setIsInitialized(true);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user?.id, shouldShowChat]);

  // Resolve current user identity (admin or sub-user)
  useEffect(() => {
    let active = true;
    
    if (!shouldShowChat) {
      setMe(null);
      return;
    }

    (async () => {
      // Handle public board access (external users without authentication)
      const isOnPublicBoard = location.pathname.startsWith('/board/');
      if (isOnPublicBoard && !user?.id) {
        // For external public board access, check if we can get user info from URL/token
        const pathParts = location.pathname.split('/');
        const accessToken = pathParts[pathParts.length - 1];
        
        if (accessToken) {
          const { data: boardAccess } = await supabase
            .from('public_board_access')
            .select('external_user_name, external_user_email, board_id')
            .eq('access_token', accessToken)
            .maybeSingle();
          
          if (active && boardAccess) {
            console.log('🎯 External user detected:', boardAccess);
            setMe({
              id: `external_${accessToken}`,
              type: "sub_user", // Treat external users as sub-users
              name: boardAccess.external_user_name || "Guest",
              avatarUrl: null
            });
            return;
          }
        }
        
        // Fallback for external access without proper token
        if (active) {
          setMe({
            id: `guest_${Date.now()}`,
            type: "sub_user",
            name: "Guest User",
            avatarUrl: null
          });
        }
        return;
      }
      
      if (!user?.id) {
        if (active) setMe(null);
        return;
      }

      // Try to find user as admin first
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      
      if (active && prof) {
        console.log('🎯 Admin user detected:', prof);
        setMe({
          id: prof.id,
          type: "admin",
          name: prof.username || "Admin",
          avatarUrl: resolveAvatarUrl(prof.avatar_url)
        });
        return;
      }
      
      // If not admin, try to find as sub-user by email
      const userEmail = user.email?.toLowerCase();
      if (!userEmail) {
        console.log('❌ No user email found');
        return;
      }

      const { data: subUser } = await supabase
        .from("sub_users")
        .select("*")
        .filter("email", "ilike", userEmail)
        .maybeSingle();

      if (active && subUser) {
        console.log('🎯 Sub-user detected:', subUser);
        setMe({
          id: subUser.id,
          type: "sub_user",
          name: subUser.fullname || "Member",
          avatarUrl: resolveAvatarUrl(subUser.avatar_url)
        });
      } else {
        console.log('❌ No matching sub-user found for email:', userEmail);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id, shouldShowChat, location.pathname]);

  // Channel and DM management
  const openChannel = useCallback((id: string) => {
    setCurrentChannelId(id);
    // Reset unread count when opening a channel
    setUnreadTotal(0);
  }, []);

  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!me || !user?.id) {
      console.log('❌ Missing me or user for DM:', { me, userId: user?.id });
      return;
    }
    
    console.log('🚀 Starting DM with:', { otherId, otherType, me, userId: user.id });
    
    try {
      // Determine the board owner for the channel
      let channelOwnerId = user.id;
      if (me.type === 'sub_user') {
        // If current user is a sub-user, find their board owner
        const { data: subUserData, error: subUserError } = await supabase
          .from('sub_users')
          .select('board_owner_id')
          .eq('id', me.id)
          .maybeSingle();
        
        if (subUserError) {
          console.error('❌ Error finding board owner:', subUserError);
        }
        
        if (subUserData) {
          channelOwnerId = subUserData.board_owner_id;
          console.log('📋 Board owner found:', channelOwnerId);
        }
      }

      // Create DM name for easier identification
      const dmName = `DM: ${me.name} & ${otherType === 'admin' ? 'Admin' : 'Member'}`;

      // Look for existing DM channel - check both participant orders
      const { data: existing, error: searchError } = await supabase
        .from("chat_channels")
        .select("id, name, participants")
        .eq("is_dm", true)
        .eq("owner_id", channelOwnerId)
        .or(`participants.cs.{${me.id},${otherId}},participants.cs.{${otherId},${me.id}}`);

      if (searchError) {
        console.error('❌ Error searching for existing DM:', searchError);
      }

      let channelId = existing?.[0]?.id;
      console.log('🔍 Existing DM found:', existing);
      
      if (!channelId) {
        console.log('🆕 Creating new DM channel');
        const { data: created, error: createError } = await supabase
          .from("chat_channels")
          .insert({
            is_dm: true,
            participants: [me.id, otherId], // Simple array of participant IDs
            name: dmName,
            owner_id: channelOwnerId
          })
          .select("id")
          .single();
        
        // Also create participant entries for proper access control
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
        
        if (createError) {
          console.error('❌ Error creating DM channel:', createError);
          return;
        }
        
        channelId = created?.id;
        console.log('✅ New DM channel created:', channelId);
      }

      if (channelId) {
        console.log('🎯 Opening DM channel:', channelId);
        openChannel(channelId);
        
        // Open chat window if not already open
        if (!isOpen) {
          console.log('📂 Opening chat window for DM');
          open();
        }
      }
    } catch (error) {
      console.error('❌ Failed to start DM:', error);
    }
  }, [me, openChannel, user?.id, isOpen, open]);

  // Unread tracking and notifications
  useEffect(() => {
    if (!me || !shouldShowChat) return;

    console.log('🔔 Setting up notification listener for:', me);

    // Get board owner ID for filtering messages
    let boardOwnerIdPromise: Promise<string | null> = (async () => {
      if (me.type === 'admin') return me.id;
      
      if (me.id.startsWith('external_') || me.id.startsWith('guest_')) {
        // For external users, get board owner from public board access
        const pathParts = location.pathname.split('/');
        const accessToken = pathParts[pathParts.length - 1];
        
        if (accessToken) {
          const { data: boardAccess } = await supabase
            .from('public_board_access')
            .select('board_id')
            .eq('access_token', accessToken)
            .maybeSingle();
            
          if (boardAccess) {
            const { data: publicBoard } = await supabase
              .from('public_boards')
              .select('user_id')
              .eq('id', boardAccess.board_id)
              .maybeSingle();
              
            if (publicBoard) {
              return publicBoard.user_id;
            }
          }
        }
        return null;
      }
      
      const { data } = await supabase.from('sub_users').select('board_owner_id').eq('id', me.id).maybeSingle();
      return data?.board_owner_id || null;
    })();

    const ch = supabase
      .channel('chat_unread_listener')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const msg = payload.new as any;
          console.log('📨 New message detected:', msg);
          
          const ownerId = await boardOwnerIdPromise;
          console.log('👤 Expected board owner ID:', ownerId);
          console.log('📄 Message owner_id:', msg.owner_id);

          // Only process messages for this board
          if (!ownerId || !msg.owner_id || msg.owner_id !== ownerId) {
            console.log('⏭️ Skipping message - owner ID mismatch', { ownerId, msgOwnerId: msg.owner_id });
            return;
          }

          // Improved detection of own messages
          const isMine = (
            // Standard user/sub-user match
            (msg.sender_user_id && me.id === msg.sender_user_id && msg.sender_type === me.type) ||
            (msg.sender_sub_user_id && me.id === msg.sender_sub_user_id && msg.sender_type === me.type) ||
            // External user name match for guests
            (me.id.startsWith('external_') || me.id.startsWith('guest_')) && 
            (msg.sender_name === me.name || msg.sender_name?.includes('Guest'))
          );
          
          const isActiveChannelMessage = (msg.channel_id === currentChannelId);
          const shouldCount = !isMine && (!isActiveChannelMessage || !isOpen);
          const shouldNotify = !isMine && (!isOpen || !isActiveChannelMessage);

          console.log('🔍 Message analysis:', {
            senderId: msg.sender_user_id,
            senderType: msg.sender_type,
            senderName: msg.sender_name,
            myId: me.id,
            myType: me.type,
            myName: me.name,
            isMine,
            isActiveChannelMessage,
            isOpen,
            shouldCount,
            shouldNotify,
            currentChannelId,
            messageChannelId: msg.channel_id
          });

          // Increment unread count for non-own messages when chat is closed or different channel
          if (shouldCount) {
            setUnreadTotal(prev => {
              const newCount = prev + 1;
              console.log('📈 Incrementing unread count:', prev, '->', newCount);
              return newCount;
            });
          }

          // Show browser notification for non-own messages
          if (shouldNotify && "Notification" in window && Notification.permission === "granted") {
            console.log('🔔 Showing browser notification');
            new Notification(msg.sender_name || "New message", { 
              body: String(msg.content || '').slice(0, 120),
              icon: '/favicon.ico',
              tag: 'chat-notification',
              silent: false
            });
          }
        }
      )
      .subscribe();

    return () => { 
      console.log('🧹 Cleaning up notification listener');
      supabase.removeChannel(ch); 
    };
  }, [me?.id, me?.type, me?.name, currentChannelId, shouldShowChat, isOpen, location.pathname]);

  // Reset unread count when chat opens or channel changes
  useEffect(() => {
    if (isOpen || currentChannelId) {
      console.log('💡 Resetting unread count - chat opened or channel switched');
      setUnreadTotal(0);
    }
  }, [isOpen, currentChannelId]);

  // Ask permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Expose a global debug toggle to verify clicks quickly
  useEffect(() => {
    (window as any).__smartbooklyChatOpen = () => {
      console.log("🧪 Toggling chat from window.__smartbooklyChatOpen()");
      toggle();
    };
  }, [toggle]);

  const value = useMemo<ChatCtx>(() => ({
    isOpen, open, close, toggle, isInitialized, hasSubUsers, me,
    currentChannelId, setCurrentChannelId, openChannel, startDM, unreadTotal
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers, me, currentChannelId, openChannel, startDM, unreadTotal]);

  // Show chat only when conditions are met
  if (!shouldShowChat) return null;

  console.log('🔍 ChatProvider render:', { 
    hasSubUsers, 
    isInitialized, 
    hasUser: !!user?.id, 
    shouldShowChat,
    path: location.pathname
  });

  // Nothing to render until portal root is ready
  if (!portalRef.current) return null;

  return (
    <ChatContext.Provider value={value}>
      {createPortal(
        <>
          {/* The icon must be pointer-events enabled inside a pointer-events:none root */}
          {/* Only show icon when chat is closed to prevent overlap with send button */}
          {isInitialized && !isOpen && (
            <div style={{ pointerEvents: "auto" }}>
              <ChatIcon onClick={toggle} isOpen={isOpen} unreadCount={unreadTotal} />
            </div>
          )}

          {/* Render window when open, also opt-in to pointer events */}
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
