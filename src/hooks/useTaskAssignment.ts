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

export const useTaskAssignment = () => {
  const { user } = useAuth();

  const { data: assignees = [], isLoading } = useQuery({
    queryKey: ['task-assignees', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const options: AssigneeOption[] = [];

      // Get admin user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        options.push({
          id: user.id,
          name: profile.username || user.email || 'Admin',
          type: 'admin',
          avatar_url: profile.avatar_url || undefined,
          email: user.email || undefined
        });
      }

      // Get sub-users
      const { data: subUsers } = await supabase
        .from('sub_users')
        .select('id, fullname, email, avatar_url')
        .eq('board_owner_id', user.id)
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
    enabled: !!user,
  });

  return { assignees, isLoading };
};
