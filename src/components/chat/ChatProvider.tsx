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
  
  // Only show chat on dashboard routes (authenticated areas)
  const isDashboardRoute = useMemo(() => {
    const p = location.pathname || "";
    const ok =
      !!user?.id &&
      (p === "/dashboard" ||
       p.startsWith("/dashboard/") ||
       p.startsWith("/board/"));
    console.log("🎯 Chat route gate", { path: p, ok, user: !!user?.id });
    return ok;
  }, [location.pathname, user?.id]);

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
        console.log("👤 No user -> hide chat");
        if (active) {
          setHasSubUsers(false);
          setIsInitialized(true);
        }
        return;
      }

      try {
        // Try the most likely table names. Replace with your actual table if different.
        // We only care "is there at least one sub-user for this owner?".
        // NOTE: This is read-only and won't break anything if the table doesn't exist; it will just log.
        let has = false;

        // 1) sub_users.board_owner_id = user.id
        try {
          const { data, error } = await supabase
            .from("sub_users")
            .select("id")
            .eq("board_owner_id", user.id)
            .limit(1);
          if (error) console.log("ℹ️ sub_users probe:", error.message);
          if (data?.length) has = true;
        } catch (e) {
          console.log("ℹ️ sub_users probe failed (table may not exist)");
        }

        if (active) {
          setHasSubUsers(has);
          setIsInitialized(true);
          console.log("✅ Chat init:", { userId: user.id, hasSubUsers: has, isDashboardRoute });
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
  }, [user?.id, isDashboardRoute]);

  // Resolve current user identity (admin or sub-user)
  useEffect(() => {
    let active = true;
    
    if (!user?.id || !isDashboardRoute) {
      setMe(null);
      return;
    }

    (async () => {
      const isAdmin = location.pathname.includes("/dashboard");
      
      if (isAdmin) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        if (active && prof) {
          setMe({
            id: prof.id,
            type: "admin",
            name: prof.username || "Admin",
            avatarUrl: await resolveAvatarUrl(prof.avatar_url || null)
          });
        }
      } else {
        const userEmail = user.email?.toLowerCase();
        if (!userEmail) return;

        const { data: subUser } = await supabase
          .from("sub_users")
          .select("*")
          .filter("email", "ilike", userEmail)
          .single();

        if (active && subUser) {
          setMe({
            id: subUser.id,
            type: "sub_user",
            name: subUser.fullname || "Member",
            avatarUrl: await resolveAvatarUrl(subUser.avatar_url || null)
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id, isDashboardRoute, location.pathname]);

  // Channel and DM management
  const openChannel = useCallback((id: string) => {
    setCurrentChannelId(id);
    // Reset unread count when opening a channel
    setUnreadTotal(0);
  }, []);

  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!me) return;
    
    console.log('🚀 Starting DM with:', { otherId, otherType, me });
    
    try {
      // Determine the board owner for the channel
      let channelOwnerId = user?.id;
      if (me.type === 'sub_user') {
        // If current user is a sub-user, find their board owner
        const { data: subUserData } = await supabase
          .from('sub_users')
          .select('board_owner_id')
          .eq('id', me.id)
          .maybeSingle();
        
        if (subUserData) {
          channelOwnerId = subUserData.board_owner_id;
        }
      }

      // find-or-create a 1:1 channel between me and other user
      const { data: existing } = await supabase
        .from("chat_channels")
        .select("id")
        .eq("is_dm", true)
        .eq("owner_id", channelOwnerId)
        .contains("participants", [me.id, otherId])
        .maybeSingle();

      let channelId = existing?.id;
      
      if (!channelId) {
        const { data: created } = await supabase
          .from("chat_channels")
          .insert({
            is_dm: true,
            participants: [me.id, otherId],
            name: null,
            owner_id: channelOwnerId
          })
          .select("id").single();
        
        channelId = created?.id;
      }

      if (channelId) {
        console.log('✅ DM channel ready:', channelId);
        openChannel(channelId);
      }
    } catch (error) {
      console.error('❌ Failed to start DM:', error);
    }
  }, [me, openChannel, user?.id]);

  // Unread tracking and notifications
  useEffect(() => {
    if (!me) return;

    let boardOwnerIdPromise: Promise<string | null> = (async () => {
      if (me.type === 'admin') return me.id;
      const { data } = await supabase.from('sub_users').select('board_owner_id').eq('id', me.id).maybeSingle();
      return data?.board_owner_id || null;
    })();

    const ch = supabase
      .channel('chat_unread_listener')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const msg = payload.new as any;
          const ownerId = await boardOwnerIdPromise;

          // Only consider messages that belong to this board owner
          if (ownerId && msg.owner_id && msg.owner_id !== ownerId) return;

          const isMine = (msg.sender_user_id === me.id && msg.sender_type === me.type);
          const isActive = (msg.channel_id === currentChannelId);

          if (!isMine && !isActive) setUnreadTotal(n => n + 1);

          if (!isMine && document.hidden && "Notification" in window && Notification.permission === "granted") {
            new Notification(msg.sender_name || "New message", { body: String(msg.content || '').slice(0,120) });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [me?.id, me?.type, currentChannelId]);

  // Reset unread count when chat opens or channel changes
  useEffect(() => {
    if (isOpen) {
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

  // Show chat when on dashboard route and logged in
  if (!isDashboardRoute || !user?.id) return null;

  console.log('🔍 ChatProvider render:', { 
    hasSubUsers, 
    isInitialized, 
    hasUser: !!user?.id, 
    isDashboardRoute,
    path: location.pathname
  });

  // Nothing to render until portal root is ready
  if (!portalRef.current) return null;

  return (
    <ChatContext.Provider value={value}>
      {createPortal(
        <>
          {/* The icon must be pointer-events enabled inside a pointer-events:none root */}
          {isInitialized && (
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
