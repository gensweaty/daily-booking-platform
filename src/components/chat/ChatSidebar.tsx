import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from './ChatProvider';
import { cn } from '@/lib/utils';

export const ChatSidebar = () => {
  const { user } = useAuth();
  const { me, currentChannelId, openChannel, startDM } = useChat();
  const [generalChannelId, setGeneralChannelId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string; type: 'admin' | 'sub_user'; avatarUrl?: string }>>([]);

  // Load general channel ID
  useEffect(() => {
    if (!user?.id) return;
    
    (async () => {
      const { data } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_default', true)
        .maybeSingle();
      
      if (data) setGeneralChannelId(data.id);
    })();
  }, [user?.id]);

  // Load team members
  useEffect(() => {
    if (!user?.id) return;
    
    (async () => {
      const teamMembers = [];
      
      // Add admin (current user or board owner)
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      if (adminProfile) {
        teamMembers.push({
          id: adminProfile.id,
          name: adminProfile.username || 'Admin',
          type: 'admin' as const,
          avatarUrl: adminProfile.avatar_url || ''
        });
      }
      
      // Add sub-users
      const { data: subUsers } = await supabase
        .from('sub_users')
        .select('id, fullname, avatar_url')
        .eq('board_owner_id', user.id);
      
      if (subUsers) {
        teamMembers.push(...subUsers.map(su => ({
          id: su.id,
          name: su.fullname || 'Member',
          type: 'sub_user' as const,
          avatarUrl: su.avatar_url || ''
        })));
      }
      
      setMembers(teamMembers);
    })();
  }, [user?.id]);

  return (
    <div className="h-full w-14 bg-muted/30 border-r border-border flex flex-col items-center py-2 gap-2">
      {/* General Channel */}
      <button
        onClick={() => generalChannelId && openChannel(generalChannelId)}
        className={cn(
          "h-10 w-10 rounded-md hover:bg-muted flex items-center justify-center transition-colors",
          currentChannelId === generalChannelId ? "bg-primary/10 text-primary" : ""
        )}
        title="General"
      >
        <span className="text-lg">💬</span>
      </button>

      <div className="my-2 h-px w-8 bg-border" />

      {/* Team Members (DM) */}
      {members.map(member => {
        const isMe = me && member.id === me.id && member.type === me.type;
        if (isMe) return null; // Don't show DM with self
        
        const initials = member.name
          .split(' ')
          .map(w => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <button
            key={`${member.type}-${member.id}`}
            onClick={() => startDM(member.id, member.type)}
            className="relative h-10 w-10 rounded-full hover:ring-2 ring-primary overflow-hidden bg-muted flex items-center justify-center text-xs font-medium"
            title={member.name}
          >
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};