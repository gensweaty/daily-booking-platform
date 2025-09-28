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
        // Fetch owner's public board id; fallback to user.id (SAME fallback Tasks uses)
        const { data: board } = await supabase
          .from("public_boards")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        // Use the board id when present, otherwise fallback to the owner's user id.
        // This mirrors the Tasks page so presence is shared.
        setBoardId((board?.id as string) || user.id);

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
          boardId: board?.id || user.id,
          displayName: candidateName,
          avatarUrl: profile?.avatar_url || (user.user_metadata?.avatar_url as string) || ""
        });
      } catch (e) {
        console.error("Failed to init CRM presence", e);
        // As a safety, still join a stable fallback channel for the owner.
        if (user?.id) setBoardId(user.id);
      }
    };
    initPresence();
  }, [user?.id]);

  const { onlineUsers } = useBoardPresence(
    boardId || undefined,
    user
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
        /* Filter out the current user - only show other users/sub-users */
        onlineUsers={
          onlineUsers?.filter(u => u.email && u.email !== user?.email) || []
        }
        currentUserEmail={user?.email}
      />
    </PermissionGate>
  );
};