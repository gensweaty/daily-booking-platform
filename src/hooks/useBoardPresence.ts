import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type BoardPresenceUser = {
  name: string;
  email: string;
  online_at?: string;
  avatar_url?: string;
};

export function useBoardPresence(
  boardId?: string | null,
  currentUser?: BoardPresenceUser | null,
  options?: { updateSubUserLastLogin?: boolean; boardOwnerId?: string | null }
) {
  const [onlineUsers, setOnlineUsers] = useState<BoardPresenceUser[]>([]);
  const [userAvatars, setUserAvatars] = useState<Map<string, string>>(new Map());

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

  const updateLastLogin = async (userEmail?: string) => {
    const emailToUpdate = userEmail || currentUser?.email;
    
    // Always try to update sub_users table for any user joining the board
    if (emailToUpdate) {
      try {
        console.log("🔄 Attempting to update sub user login for:", emailToUpdate);
        
        // First try to find if this is a sub-user
        const { data: subUserCheck, error: checkError } = await supabase
          .from("sub_users")
          .select("id, board_owner_id, email")
          .ilike("email", emailToUpdate.trim().toLowerCase())
          .limit(1);
          
        if (checkError) {
          console.error("Error checking sub user:", checkError);
          return;
        }
        
        if (subUserCheck && subUserCheck.length > 0) {
          const subUser = subUserCheck[0];
          console.log("📋 Found sub user, updating login time:", subUser);
          
          const { data, error } = await supabase
            .from("sub_users")
            .update({
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", subUser.id)
            .select();
          
          if (error) {
            console.error("❌ Error updating sub user last login:", error);
          } else {
            console.log("✅ Successfully updated sub user last login:", data);
          }
        } else {
          console.log("ℹ️ User is not a sub-user:", emailToUpdate);
        }
      } catch (e) {
        console.error("❌ Failed updating sub user last login", e);
      }
    }
  };

    const fetchUserAvatars = async (emails: string[]) => {
      const newAvatars = new Map(userAvatars);
      
      for (const email of emails) {
        if (!newAvatars.has(email)) {
          try {
            // First try profiles table (main users)
            const { data: profile } = await supabase
              .from('profiles')
              .select('avatar_url')
              .ilike('email', email.trim().toLowerCase())
              .maybeSingle();
            
            if (profile?.avatar_url) {
              newAvatars.set(email, profile.avatar_url);
              continue;
            }
            
            // Then try sub_users table
            const { data: subUser } = await supabase
              .from('sub_users')
              .select('avatar_url')
              .ilike('email', email.trim().toLowerCase())
              .maybeSingle();
            
            if (subUser?.avatar_url) {
              newAvatars.set(email, subUser.avatar_url);
            }
          } catch (error) {
            console.error('Error fetching avatar for', email, error);
          }
        }
      }
      
      setUserAvatars(newAvatars);
    };

    const handleSync = async () => {
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
                online_at: u.online_at || new Date().toISOString(),
                avatar_url: userAvatars.get(u.email) || u.avatar_url
              });
            }
          }
        });
      });
      
      const users = Array.from(byEmail.values());
      const emails = users.map(u => u.email).filter(Boolean);
      
      // Fetch avatars for new users
      if (emails.length > 0) {
        await fetchUserAvatars(emails);
      }
      
      // Update users with avatar URLs
      const usersWithAvatars = users.map(user => ({
        ...user,
        avatar_url: userAvatars.get(user.email) || user.avatar_url
      }));
      
      setOnlineUsers(usersWithAvatars);
    };

    let heartbeatInterval: NodeJS.Timeout;
    let reconnectTimeout: NodeJS.Timeout;

    const trackPresence = async () => {
      try {
        await channel.track({
          name: currentUser.name,
          email: currentUser.email,
          online_at: new Date().toISOString(),
          avatar_url: currentUser.avatar_url,
        });
      } catch (e) {
        console.error("Failed to track presence:", e);
      }
    };

    channel
      .on("presence", { event: "sync" }, async () => {
        console.log("Presence sync");
        await handleSync();
      })
      .on("presence", { event: "join" }, async ({ key, newPresences }) => {
        console.log("User joined presence:", key, newPresences);
        // Update last login for any user who joins presence
        const joinedUser = newPresences?.[0];
        if (joinedUser?.email) {
          await updateLastLogin(joinedUser.email);
        }
        await handleSync();
      })
      .on("presence", { event: "leave" }, async ({ key, leftPresences }) => {
        console.log("User left presence:", key, leftPresences);
        await handleSync();
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
  }, [boardId, currentUser?.email, currentUser?.name, currentUser?.avatar_url, options?.updateSubUserLastLogin, options?.boardOwnerId, userAvatars]);

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
