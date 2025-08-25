import { useState, useEffect } from 'react';
import { Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from './ChatProvider';
import { cn } from '@/lib/utils';
import { resolveAvatarUrl } from './_avatar';

export const ChatSidebar = () => {
  const { user } = useAuth();
  const { me, currentChannelId, openChannel, startDM } = useChat();
  const [generalChannelId, setGeneralChannelId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ 
    id: string; 
    name: string; 
    type: 'admin' | 'sub_user'; 
    avatar_url?: string | null;
  }>>([]);

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
    if (!user?.id || !me) return;
    
    (async () => {
      const teamMembers = [];
      
      // Determine the board owner ID
      let boardOwnerId = user.id;
      if (me.type === 'sub_user') {
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
          avatar_url: adminProfile.avatar_url
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
          avatar_url: su.avatar_url
        })));
      }
      
      setMembers(teamMembers);
    })();
  }, [user?.id, me]);

  return (
    <div className="w-full h-full bg-muted/20 p-4 overflow-y-auto">
      <div className="space-y-2">
        {/* General Channel */}
        <button
          onClick={() => generalChannelId && openChannel(generalChannelId)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors text-left",
            currentChannelId === generalChannelId ? "bg-primary/10 text-primary" : ""
          )}
        >
          <Hash className="h-4 w-4" />
          <span className="font-medium">General</span>
        </button>

        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-wide">
            Team Members
          </p>
          
          {members.map((member) => {
            const isMe = me && member.id === me.id && member.type === me.type;
            if (isMe) return null; // Don't show DM with self
            
            return (
              <button
                key={`${member.type}-${member.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🖱️ Starting DM with member:', member);
                  startDM(member.id, member.type);
                }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex-shrink-0 relative">
                  <div className="h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                    {resolveAvatarUrl(member.avatar_url) ? (
                      <img
                        src={resolveAvatarUrl(member.avatar_url)!}
                        alt={member.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.initials-fallback')) {
                            const initials = document.createElement('span');
                            initials.className = 'text-xs font-medium text-foreground initials-fallback';
                            initials.textContent = (member.name || "U")
                              .split(" ")
                              .map(w => w[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2);
                            parent.appendChild(initials);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-xs font-medium text-foreground">
                        {(member.name || "U")
                          .split(" ")
                          .map(w => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {member.type === 'admin' ? 'Owner' : 'Team Member'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};