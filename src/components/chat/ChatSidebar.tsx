import { useState, useEffect } from 'react';
import { Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { cn } from '@/lib/utils';
import { resolveAvatarUrl } from './_avatar';

export const ChatSidebar = () => {
  const { me, boardOwnerId, currentChannelId, openChannel, startDM } = useChat();
  const [generalChannelId, setGeneralChannelId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ 
    id: string; 
    name: string; 
    type: 'admin' | 'sub_user'; 
    avatar_url?: string | null;
  }>>([]);

  // Load general channel
  useEffect(() => {
    if (!boardOwnerId) return;
    
    (async () => {
      const { data } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('owner_id', boardOwnerId)
        .eq('is_default', true)
        .maybeSingle();
      
      if (data) {
        console.log('✅ General channel found:', data.id);
        setGeneralChannelId(data.id);
      }
    })();
  }, [boardOwnerId]);

  // Load team members
  useEffect(() => {
    if (!boardOwnerId) return;
    
    (async () => {
      const teamMembers = [];
      
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
      
      // Add sub-users
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
      
      console.log('👥 Team members loaded:', teamMembers);
      setMembers(teamMembers);
    })();
  }, [boardOwnerId]);

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

        {/* Team Members */}
        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-wide">
            Team Members
          </p>
          
          {members.map((member) => {
            // Don't show DM with self
            const isMe = me && member.id === me.id && member.type === me.type;
            if (isMe) return null;
            
            return (
              <button
                key={`${member.type}-${member.id}`}
                onClick={async () => {
                  console.log('🖱️ Starting DM with:', member);
                  try {
                    await startDM(member.id, member.type);
                    console.log('✅ DM started successfully');
                  } catch (error) {
                    console.error('❌ Failed to start DM:', error);
                  }
                }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-all text-left"
              >
                <div className="h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                  {resolveAvatarUrl(member.avatar_url) ? (
                    <img
                      src={resolveAvatarUrl(member.avatar_url)!}
                      alt={member.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium">
                      {(member.name || "U").slice(0, 2).toUpperCase()}
                    </span>
                  )}
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
          
          {members.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-4">
              No team members found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};