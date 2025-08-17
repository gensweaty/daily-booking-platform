import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChatIcon } from "./ChatIcon";
import { ChatWindow } from "./ChatWindow";

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

  // UI state
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    // restore last open state if you want; default closed
    const s = localStorage.getItem("chat_isOpen");
    return s === "true";
  });
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
      node.style.pointerEvents = "auto"; // allow all interactions
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

  // Identity resolution with correct schema mapping
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) { if (active) setMe(null); return; }

      // try sub_users first (sub user logged into external board)
      const { data: su } = await supabase
        .from("sub_users")
        .select("id, fullname, avatar_url")
        .eq("board_owner_id", user.id) // adjust if your sub_users links to auth user by another column
        .maybeSingle();

      if (active && su) {
        setMe({ id: su.id, type: "sub_user", name: su.fullname || "Member", avatarUrl: su.avatar_url || "" });
        return;
      }

      // fall back to profiles (admin)
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (active && prof) {
        setMe({ id: prof.id, type: "admin", name: prof.username || "Admin", avatarUrl: prof.avatar_url || "" });
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  // Channel and DM management
  const openChannel = useCallback((id: string) => {
    setCurrentChannelId(id);
    // TODO: mark channel read when RPC is implemented
  }, []);

  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!me) return;
    // find-or-create a 1:1 channel between me and other user
    const { data: existing } = await supabase
      .from("chat_channels")
      .select("id")
      .eq("is_dm", true)
      .contains("participants", [me.id, otherId])
      .maybeSingle();

    const channelId = existing?.id ?? (await supabase
      .from("chat_channels")
      .insert({
        is_dm: true,
        participants: [me.id, otherId],
        name: null,
        owner_id: me.type === 'admin' ? me.id : user?.id // use board owner for DMs
      })
      .select("id").single()).data.id;

    openChannel(channelId);
  }, [me, openChannel, user?.id]);

  // Unread tracking and notifications
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("chat_unread_listener")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as any;
        const isMine = (msg.sender_user_id === me.id && msg.sender_type === me.type);
        const isActive = msg.channel_id === currentChannelId;
        if (!isMine && !isActive) setUnreadTotal((n) => n + 1);

        // Browser notification
        if (!isMine && document.hidden) {
          if (Notification.permission === "granted") {
            new Notification(msg.sender_name || "New message", { body: msg.content.slice(0, 120) });
          }
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me?.id, me?.type, currentChannelId]);

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

  // before returning the portal, short-circuit:
  if (!isDashboardRoute) {
    return null;            // hides icon/window on login, landing, etc.
  }

  // before: only checked hasSubUsers
  if (!hasSubUsers || !isDashboardRoute) return null;

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
