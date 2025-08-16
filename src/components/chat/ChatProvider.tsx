import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChatIcon } from "./ChatIcon";
import { ChatWindow } from "./ChatWindow";

type ChatCtx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isInitialized: boolean;
  hasSubUsers: boolean;
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
  
  // Only show chat on dashboard routes
  const isDashboardRoute = useMemo(() => {
    const path = location.pathname;
    // Show on main dashboard, external board, and other dashboard pages
    return path === '/dashboard' || 
           path.startsWith('/board/') || 
           path === '/admin' || 
           path === '/tasks' || 
           path === '/calendar' || 
           path === '/crm' || 
           path === '/statistics' ||
           path === '/business';
  }, [location.pathname]);

  // UI state
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    // restore last open state if you want; default closed
    const s = localStorage.getItem("chat_isOpen");
    return s === "true";
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasSubUsers, setHasSubUsers] = useState(false);

  // Make one portal root for chat
  const portalRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let node = document.getElementById("chat-root") as HTMLElement | null;
    if (!node) {
      node = document.createElement("div");
      node.id = "chat-root";
      node.style.position = "fixed";
      node.style.inset = "0";
      node.style.pointerEvents = "none"; // let floating controls opt-in
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
          console.log("✅ Chat init:", { userId: user.id, hasSubUsers: has });
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
  }, [user?.id]);

  // Expose a global debug toggle to verify clicks quickly
  useEffect(() => {
    (window as any).__smartbooklyChatOpen = () => {
      console.log("🧪 Toggling chat from window.__smartbooklyChatOpen()");
      toggle();
    };
  }, [toggle]);

  const value = useMemo<ChatCtx>(() => ({
    isOpen, open, close, toggle, isInitialized, hasSubUsers
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers]);

  // Gate: only show icon if we have sub-users AND we've finished init AND we're on a dashboard route
  const shouldShowIcon = isInitialized && hasSubUsers && isDashboardRoute;

  // Nothing to render until portal root is ready
  if (!portalRef.current) return null;

  return (
    <ChatContext.Provider value={value}>
      {createPortal(
        <>
          {/* The icon must be pointer-events enabled inside a pointer-events:none root */}
          {shouldShowIcon && (
            <div style={{ pointerEvents: "auto" }}>
              <ChatIcon onClick={toggle} isOpen={isOpen} unreadCount={0} />
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