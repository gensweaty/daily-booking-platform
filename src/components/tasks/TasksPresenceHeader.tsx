import { useEffect, useMemo, useState } from "react";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { useBoardPresence } from "@/hooks/useBoardPresence";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export const TasksPresenceHeader = ({ max = 5 }: { max?: number } = {}) => {
  const { user } = useAuth();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      try {
        // Fetch owner's public board id
        const { data: board } = await supabase
          .from("public_boards")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        setBoardId(board?.id || null);

        // Fetch owner's profile username and avatar as display info
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        setDisplayName(profile?.username || (user.user_metadata?.full_name as string) || "Admin");
        setAvatarUrl(profile?.avatar_url || "");
      } catch (e) {
        console.error("Failed to init TasksPresenceHeader", e);
      }
    };
    init();

    // Listen for profile updates to refresh avatar instantly
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user?.id}`
        },
        (payload) => {
          if (payload.new.avatar_url) {
            setAvatarUrl(payload.new.avatar_url);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const { onlineUsers } = useBoardPresence(
    boardId,
    user ? { name: displayName, email: user.email || "", avatar_url: avatarUrl } : null
  );

  const users = useMemo(() => onlineUsers.map(u => ({
    name: u.name || u.email?.split("@")[0] || "User",
    email: u.email || "",
    avatar_url: u.avatar_url
  })), [onlineUsers]);

  if (!boardId) return null;
  return (
    <div className="flex items-center ml-0 sm:ml-2">
      <PresenceAvatars users={users} currentUserEmail={user?.email || undefined} max={max} />
    </div>
  );
};
