import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type BoardPresenceUser = {
  name: string;
  email: string;
  online_at?: string;
};

export function useBoardPresence(
  boardId?: string | null,
  currentUser?: BoardPresenceUser | null,
  options?: { updateSubUserLastLogin?: boolean; boardOwnerId?: string | null }
) {
  const [onlineUsers, setOnlineUsers] = useState<BoardPresenceUser[]>([]);

  useEffect(() => {
    if (!boardId || !currentUser) return;

    // Use a shared channel for all users but stable email-based keys
    const channel = supabase.channel(`presence:public-board:${boardId}`, {
      config: { 
        presence: { 
          key: currentUser.email // Use email as stable key
        } 
      },
    });

    const updateLastLogin = async () => {
      if (options?.updateSubUserLastLogin && options?.boardOwnerId) {
        try {
          await supabase
            .from("sub_users")
            .update({
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("board_owner_id", options.boardOwnerId)
            .ilike("email", (currentUser.email || "").trim().toLowerCase());
        } catch (e) {
          console.error("Failed updating sub user last login", e);
        }
      }
    };

    const handleSync = () => {
      const state = channel.presenceState() as Record<string, BoardPresenceUser[]>;
      // Flatten and dedupe by email (strip session suffix)
      const byEmail = new Map<string, BoardPresenceUser>();
      Object.values(state).forEach((arr) => {
        arr.forEach((u) => {
          if (u?.email) {
            // Always use the latest presence data
            byEmail.set(u.email, {
              ...u,
              online_at: new Date().toISOString() // Update to current time
            });
          }
        });
      });
      setOnlineUsers(Array.from(byEmail.values()));
    };

    let heartbeatInterval: NodeJS.Timeout;

    channel
      .on("presence", { event: "sync" }, handleSync)
      .on("presence", { event: "join" }, async ({ key, newPresences }) => {
        console.log("User joined presence:", key, newPresences);
        // Update last login for any user joining (including current user)
        const joinedUser = newPresences?.[0];
        if (joinedUser?.email === currentUser.email) {
          await updateLastLogin();
        }
        handleSync(); // Refresh the state
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("User left presence:", key, leftPresences);
        handleSync(); // Refresh the state
      })
      .subscribe(async (status) => {
        console.log("Presence subscription status:", status);
        if (status !== "SUBSCRIBED") return;
        
        // Track presence with current timestamp
        await channel.track({
          name: currentUser.name,
          email: currentUser.email,
          online_at: new Date().toISOString(),
        });

        // Update last login on initial connect
        await updateLastLogin();

        // Set up heartbeat to maintain presence and update login time
        heartbeatInterval = setInterval(async () => {
          try {
            // Re-track to maintain presence
            await channel.track({
              name: currentUser.name,
              email: currentUser.email,
              online_at: new Date().toISOString(),
            });
            // Update last login periodically
            await updateLastLogin();
          } catch (e) {
            console.error("Heartbeat failed:", e);
          }
        }, 30000); // Every 30 seconds
      });

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      supabase.removeChannel(channel);
    };
  }, [boardId, currentUser?.email, currentUser?.name, options?.updateSubUserLastLogin, options?.boardOwnerId]);

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
