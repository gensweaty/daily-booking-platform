import { useEffect, useState } from "react";
import { PermissionGate } from "@/components/PermissionGate";
import CustomerList from "./CustomerList";
import { useAuth } from "@/contexts/AuthContext";
import { useBoardPresence } from "@/hooks/useBoardPresence";
import { supabase } from "@/lib/supabase";

export const CRMWithPermissions = () => {
  const { user } = useAuth();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  useEffect(() => {
    const initPresence = async () => {
      if (!user) return;
      try {
        // Fetch owner's public board id (use the SAME id Tasks uses)
        const { data: board } = await supabase
          .from("public_boards")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        // IMPORTANT: don't invent a CRM-specific channel; use the board id so it's shared with Tasks
        setBoardId(board?.id ?? null);

        // Fetch owner's profile username and avatar as display info
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        const candidateName =
          profile?.username ||
          (user.user_metadata?.full_name as string) ||
          (user.email ? user.email.split("@")[0] : "") ||
          "Member";
        setDisplayName(candidateName);
        setAvatarUrl(profile?.avatar_url || (user.user_metadata?.avatar_url as string) || "");
        
        console.log("🔍 CRM Presence Init:", {
          userId: user.id,
          boardId: board?.id ?? null,
          displayName: candidateName,
          avatarUrl: profile?.avatar_url || (user.user_metadata?.avatar_url as string) || ""
        });
      } catch (e) {
        console.error("Failed to init CRM presence", e);
        // If we can't resolve the shared board id, don't join a different channel.
        setBoardId(null);
      }
    };
    initPresence();
  }, [user?.id]);

  const { onlineUsers } = useBoardPresence(
    boardId ?? undefined,
    boardId && user
      ? {
          name: displayName,
          email: user.email || "",
          avatar_url: avatarUrl,
          online_at: new Date().toISOString(),
        }
      : null
  );

  // Debug presence
  useEffect(() => {
    console.log('🔍 CRM Presence Debug:', {
      boardId,
      user: user ? {
        name: displayName,
        email: user.email,
        avatar_url: avatarUrl
      } : null,
      onlineUsers: onlineUsers.length,
      onlineUsersList: onlineUsers
    });
  }, [boardId, displayName, user?.email, avatarUrl, onlineUsers]);

  return (
    <PermissionGate requiredPermission="crm">
      <CustomerList 
        onlineUsers={onlineUsers}
        currentUserEmail={user?.email}
      />
    </PermissionGate>
  );
};