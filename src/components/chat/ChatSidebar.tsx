import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from './ChatProvider';
import { cn } from '@/lib/utils';
import { resolveAvatarUrl } from './_avatar';

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

  // Load team members (determine correct board owner)
  useEffect(() => {
    if (!user?.id || !me) return;
    
    (async () => {
      const teamMembers = [];
      
      // Determine the board owner ID
      let boardOwnerId = user.id;
      if (me.type === 'sub_user') {
        // If current user is a sub-user, find their board owner
        const { data: subUserData } = await supabase
          .from('sub_users')
          .select('board_owner_id')
          .eq('id', me.id)
          .maybeSingle();
        
        if (subUserData) {
          boardOwnerId = subUserData.board_owner_id;
        }
      }
      
      // Add admin (board owner)
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', boardOwnerId)
        .maybeSingle();
      
      if (adminProfile) {
        teamMembers.push({
          id: adminProfile.id,
          name: adminProfile.username || 'Admin',
          type: 'admin' as const,
          avatarUrl: adminProfile.avatar_url || null
        });
      }
      
      // Add sub-users for this board
      const { data: subUsers } = await supabase
        .from('sub_users')
        .select('id, fullname, avatar_url')
        .eq('board_owner_id', boardOwnerId);
      
      if (subUsers) {
        teamMembers.push(...subUsers.map(su => ({
          id: su.id,
          name: su.fullname || 'Member',
          type: 'sub_user' as const,
          avatarUrl: su.avatar_url || null
        })));
      }
      
      // Resolve avatar URLs
      const resolved = await Promise.all(teamMembers.map(async m => ({
        ...m,
        avatarUrl: await resolveAvatarUrl(m.avatarUrl || null)
      })));
      
      setMembers(resolved);
    })();
  }, [user?.id, me]);

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

        return (
          <button
            key={`${member.type}-${member.id}`}
            onClick={() => startDM(member.id, member.type)}
            className="relative h-10 w-10 rounded-full hover:ring-2 ring-primary overflow-hidden bg-muted flex items-center justify-center text-xs font-medium"
            title={member.name}
          >
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector(".initials-fallback")) {
                    const span = document.createElement("span");
                    span.className = "text-xs font-medium initials-fallback";
                    span.textContent = (member.name || "U")
                      .split(" ")
                      .filter(Boolean)
                      .map(w => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    parent.appendChild(span);
                  }
                }}
              />
            ) : (
              <span className="text-xs font-medium initials-fallback">
                {(member.name || "U")
                  .split(" ")
                  .filter(Boolean)
                  .map(w => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};