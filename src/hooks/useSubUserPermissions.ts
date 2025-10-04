import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface SubUserPermissions {
  calendar_permission: boolean;
  crm_permission: boolean;
  statistics_permission: boolean;
}

export interface UserWithPermissions extends SubUserPermissions {
  id: string;
  fullname: string;
  email: string;
  last_login_at: string;
  created_at: string;
  board_owner_id: string;
}

export const useSubUserPermissions = () => {
  const { user } = useAuth();
  const [currentUserPermissions, setCurrentUserPermissions] = useState<SubUserPermissions>({
    calendar_permission: false,
    crm_permission: false,
    statistics_permission: false,
  });
  const [isSubUser, setIsSubUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      checkSubUserPermissions();
    }
  }, [user?.email]);

  const checkSubUserPermissions = async () => {
    if (!user?.email) return;

    setLoading(true);
    try {
      const { data: subUserData, error } = await supabase
        .from('sub_users')
        .select('calendar_permission, crm_permission, statistics_permission')
        .ilike('email', user.email.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        console.error("Error checking sub user permissions:", error);
        setIsSubUser(false);
        setCurrentUserPermissions({
          calendar_permission: false,
          crm_permission: false,
          statistics_permission: false,
        });
      } else if (subUserData) {
        setIsSubUser(true);
        setCurrentUserPermissions({
          calendar_permission: subUserData.calendar_permission || false,
          crm_permission: subUserData.crm_permission || false,
          statistics_permission: subUserData.statistics_permission || false,
        });
      } else {
        // User is admin (not a sub-user)
        setIsSubUser(false);
        setCurrentUserPermissions({
          calendar_permission: true,
          crm_permission: true,
          statistics_permission: true,
        });
      }
    } catch (error) {
      console.error("Error in checkSubUserPermissions:", error);
      setIsSubUser(false);
      setCurrentUserPermissions({
        calendar_permission: false,
        crm_permission: false,
        statistics_permission: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSubUserPermissions = async (subUserId: string, permissions: SubUserPermissions) => {
    try {
      const { error } = await supabase
        .from('sub_users')
        .update(permissions)
        .eq('id', subUserId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("Error updating sub user permissions:", error);
      return { success: false, error };
    }
  };

  const hasPermission = (page: 'calendar' | 'crm' | 'statistics') => {
    if (!isSubUser) return true; // Admin has all permissions
    
    switch (page) {
      case 'calendar':
        return currentUserPermissions.calendar_permission;
      case 'crm':
        return currentUserPermissions.crm_permission;
      case 'statistics':
        return currentUserPermissions.statistics_permission;
      default:
        return false;
    }
  };

  return {
    currentUserPermissions,
    isSubUser,
    loading,
    hasPermission,
    updateSubUserPermissions,
    checkSubUserPermissions,
  };
};