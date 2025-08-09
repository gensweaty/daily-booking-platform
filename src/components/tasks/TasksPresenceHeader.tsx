import { useEffect, useMemo, useState } from "react";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { useBoardPresence } from "@/hooks/useBoardPresence";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export const TasksPresenceHeader = () => {
  const { user } = useAuth();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

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

        // Fetch owner's profile username as display name
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        setDisplayName(profile?.username || user.email || "Admin");
      } catch (e) {
        console.error("Failed to init TasksPresenceHeader", e);
      }
    };
    init();
  }, [user?.id]);

  const { onlineUsers } = useBoardPresence(
    boardId,
    user ? { name: displayName, email: user.email || "" } : null
  );

  const users = useMemo(() => onlineUsers, [onlineUsers]);

  if (!boardId) return null;
  return (
    <div className="flex items-center ml-0 sm:ml-2">
      <PresenceAvatars users={users} currentUserEmail={user?.email || undefined} max={3} />
    </div>
  );
};
