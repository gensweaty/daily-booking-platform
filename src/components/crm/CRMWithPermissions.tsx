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
        console.error("Failed to init CRM presence", e);
      }
    };
    initPresence();
  }, [user?.id]);

  const { onlineUsers } = useBoardPresence(
    boardId,
    user ? { name: displayName, email: user.email || "", avatar_url: avatarUrl } : null
  );

  return (
    <PermissionGate requiredPermission="crm">
      <CustomerList 
        onlineUsers={onlineUsers}
        currentUserEmail={user?.email}
      />
    </PermissionGate>
  );
};