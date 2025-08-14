import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubUserPermissions } from "./useSubUserPermissions";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/utils/permissionUtils";

interface UseUserContextProps {
  isPublicMode?: boolean;
  externalUserName?: string;
  externalUserEmail?: string;
}

export const useUserContext = ({
  isPublicMode = false,
  externalUserName,
  externalUserEmail,
}: UseUserContextProps = {}): UserContext & { subUserFullname?: string; loading: boolean } => {
  const { user } = useAuth();
  const { isSubUser, loading: permissionsLoading } = useSubUserPermissions();
  const [subUserFullname, setSubUserFullname] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubUserFullname = async () => {
      if (user?.email && isSubUser) {
        try {
          const { data, error } = await supabase
            .from('sub_users')
            .select('fullname')
            .ilike('email', user.email.trim().toLowerCase())
            .single();

          if (!error && data) {
            setSubUserFullname(data.fullname);
          }
        } catch (error) {
          console.error('Error fetching sub-user fullname:', error);
        }
      }
      setLoading(false);
    };

    if (!permissionsLoading) {
      fetchSubUserFullname();
    }
  }, [user?.email, isSubUser, permissionsLoading]);

  const userContext: UserContext = {
    id: user?.id,
    email: user?.email,
    fullname: subUserFullname,
    isAuthenticated: !!user,
    isSubUser,
    isPublicMode,
    publicUserName: externalUserName,
    publicUserEmail: externalUserEmail,
  };

  return {
    ...userContext,
    subUserFullname,
    loading: loading || permissionsLoading,
  };
};