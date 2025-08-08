import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type BoardPresenceUser = {
  name: string;
  email: string;
  online_at?: string;
};

export function useBoardPresence(
  boardId?: string | null,
  currentUser?: BoardPresenceUser | null
) {
  const [onlineUsers, setOnlineUsers] = useState<BoardPresenceUser[]>([]);

  useEffect(() => {
    if (!boardId || !currentUser) return;

    // Use email as stable presence key so reconnects don't duplicate
    const channel = supabase.channel(`presence:public-board:${boardId}`, {
      config: { presence: { key: currentUser.email } },
    });

    const handleSync = () => {
      const state = channel.presenceState() as Record<string, BoardPresenceUser[]>;
      // Flatten and dedupe by email
      const byEmail = new Map<string, BoardPresenceUser>();
      Object.values(state).forEach((arr) => {
        arr.forEach((u) => {
          if (u?.email) byEmail.set(u.email, u);
        });
      });
      setOnlineUsers(Array.from(byEmail.values()));
    };

    channel
      .on("presence", { event: "sync" }, handleSync)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel.track({
          name: currentUser.name,
          email: currentUser.email,
          online_at: new Date().toISOString(),
        });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, currentUser?.email, currentUser?.name]);

  const sortedUsers = useMemo(() => {
    // Put current user first, then alphabetical
    return onlineUsers
      .slice()
      .sort((a, b) => {
        if (currentUser && a.email === currentUser.email) return -1;
        if (currentUser && b.email === currentUser.email) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [onlineUsers, currentUser]);

  return { onlineUsers: sortedUsers };
}
