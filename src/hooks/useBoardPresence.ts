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

    // Use a unique channel per board with stable presence key per user
    const channel = supabase.channel(`presence:board:${boardId}`, {
      config: { 
        presence: { 
          key: `${currentUser.email}-${Date.now()}` // Include timestamp to ensure reconnection works
        } 
      },
    });

    const updateLastLogin = async () => {
      if (options?.updateSubUserLastLogin && options?.boardOwnerId && currentUser.email) {
        try {
          const { data, error } = await supabase
            .from("sub_users")
            .update({
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("board_owner_id", options.boardOwnerId)
            .ilike("email", currentUser.email.trim().toLowerCase())
            .select();
          
          if (error) {
            console.error("Error updating sub user last login:", error);
          } else {
            console.log("Updated sub user last login:", data);
          }
        } catch (e) {
          console.error("Failed updating sub user last login", e);
        }
      }
    };

    const handleSync = () => {
      const state = channel.presenceState() as Record<string, BoardPresenceUser[]>;
      // Flatten and dedupe by email
      const byEmail = new Map<string, BoardPresenceUser>();
      Object.values(state).forEach((arr) => {
        arr.forEach((u) => {
          if (u?.email) {
            // Keep the most recent presence entry for each email
            const existing = byEmail.get(u.email);
            if (!existing || (u.online_at && (!existing.online_at || u.online_at > existing.online_at))) {
              byEmail.set(u.email, {
                ...u,
                online_at: u.online_at || new Date().toISOString()
              });
            }
          }
        });
      });
      setOnlineUsers(Array.from(byEmail.values()));
    };

    let heartbeatInterval: NodeJS.Timeout;
    let reconnectTimeout: NodeJS.Timeout;

    const trackPresence = async () => {
      try {
        await channel.track({
          name: currentUser.name,
          email: currentUser.email,
          online_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Failed to track presence:", e);
      }
    };

    channel
      .on("presence", { event: "sync" }, () => {
        console.log("Presence sync");
        handleSync();
      })
      .on("presence", { event: "join" }, async ({ key, newPresences }) => {
        console.log("User joined presence:", key, newPresences);
        // Update last login for the current user when they join
        const joinedUser = newPresences?.[0];
        if (joinedUser?.email === currentUser.email) {
          await updateLastLogin();
        }
        handleSync();
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("User left presence:", key, leftPresences);
        handleSync();
      })
      .subscribe(async (status) => {
        console.log("Presence subscription status:", status);
        
        if (status === "SUBSCRIBED") {
          // Initial presence tracking
          await trackPresence();
          await updateLastLogin();

          // Set up heartbeat to maintain presence and update login time every minute
          heartbeatInterval = setInterval(async () => {
            await trackPresence();
            await updateLastLogin();
          }, 60000); // Every 60 seconds

        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.log("Presence connection lost, attempting to reconnect...");
          // Clear existing interval
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null as any;
          }
          
          // Attempt to reconnect after a delay
          reconnectTimeout = setTimeout(() => {
            channel.subscribe();
          }, 2000);
        }
      });

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
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
