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

        // Fetch owner's profile username as display name
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        setDisplayName(profile?.username || (user.user_metadata?.full_name as string) || "Admin");
      } catch (e) {
        console.error("Failed to init CRM presence", e);
      }
    };
    initPresence();
  }, [user?.id]);

  const { onlineUsers } = useBoardPresence(
    boardId,
    user ? { name: displayName, email: user.email || "" } : null
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