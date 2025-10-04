import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface AssigneeOption {
  id: string;
  name: string;
  type: 'admin' | 'sub_user';
  avatar_url?: string;
  email?: string;
}

export const useTaskAssignment = (boardOwnerId?: string) => {
  const { user } = useAuth();

  // Use boardOwnerId if provided (for public boards), otherwise use current user's id
  const effectiveUserId = boardOwnerId || user?.id;

  const { data: assignees = [], isLoading } = useQuery({
    queryKey: ['task-assignees', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      const options: AssigneeOption[] = [];

      // Get admin user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', effectiveUserId)
        .maybeSingle();

      if (profile) {
        // Get admin email
        const { data: userData } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', effectiveUserId)
          .maybeSingle();

        options.push({
          id: effectiveUserId,
          name: profile.username || 'Admin',
          type: 'admin',
          avatar_url: profile.avatar_url || undefined,
          email: userData ? undefined : undefined
        });
      }

      // Get sub-users
      const { data: subUsers } = await supabase
        .from('sub_users')
        .select('id, fullname, email, avatar_url')
        .eq('board_owner_id', effectiveUserId)
        .order('fullname');

      if (subUsers) {
        subUsers.forEach(subUser => {
          options.push({
            id: subUser.id,
            name: subUser.fullname || subUser.email,
            type: 'sub_user',
            avatar_url: subUser.avatar_url || undefined,
            email: subUser.email
          });
        });
      }

      return options;
    },
    enabled: !!effectiveUserId,
  });

  return { assignees, isLoading };
};
