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

  // Load general channel with participants check
  useEffect(() => {
    if (!boardOwnerId) return;
    
    (async () => {
      console.log('🔍 Loading General channel for board owner:', boardOwnerId);
      
      // Find General channel that has participants (the active one)
      const { data, error } = await supabase
        .from('chat_channels')
        .select(`
          id, 
          name,
          chat_participants!inner(id)
        `)
        .eq('owner_id', boardOwnerId)
        .eq('is_default', true)
        .eq('name', 'General')
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Error loading General channel:', error);
        return;
      }
      
      if (data) {
        console.log('✅ General channel found with participants:', data.id);
        setGeneralChannelId(data.id);
      } else {
        console.log('⚠️ No General channel with participants found');
        // Fallback: get any General channel for this owner
        const { data: fallback } = await supabase
          .from('chat_channels')
          .select('id')
          .eq('owner_id', boardOwnerId)
          .eq('is_default', true)
          .eq('name', 'General')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
          
        if (fallback) {
          console.log('📋 Using fallback General channel:', fallback.id);
          setGeneralChannelId(fallback.id);
        }
      }
    })();
  }, [boardOwnerId]);

  // Load team members
  useEffect(() => {
    if (!boardOwnerId) {
      console.log('❌ No boardOwnerId for loading team members');
      setMembers([]);
      return;
    }
    
    console.log('👥 Loading team members for board owner:', boardOwnerId);
    
    (async () => {
      try {
        const teamMembers = [];
        
        // Add admin (board owner)
        console.log('🔍 Loading admin profile for:', boardOwnerId);
        const { data: adminProfile, error: adminError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('id', boardOwnerId)
          .maybeSingle();
        
        if (adminError) {
          console.error('❌ Error loading admin profile:', adminError);
        } else if (adminProfile) {
          console.log('✅ Admin profile loaded:', adminProfile.username);
          teamMembers.push({
            id: adminProfile.id,
            name: adminProfile.username || 'Admin',
            type: 'admin' as const,
            avatar_url: adminProfile.avatar_url
          });
        } else {
          console.log('⚠️ No admin profile found for board owner');
        }
        
        // Add sub-users
        console.log('🔍 Loading sub-users for board owner:', boardOwnerId);
        const { data: subUsers, error: subUsersError } = await supabase
          .from('sub_users')
          .select('id, fullname, avatar_url')
          .eq('board_owner_id', boardOwnerId);
        
        if (subUsersError) {
          console.error('❌ Error loading sub-users:', subUsersError);
        } else if (subUsers && subUsers.length > 0) {
          console.log('✅ Sub-users loaded:', subUsers.length, 'users');
          teamMembers.push(...subUsers.map(su => ({
            id: su.id,
            name: su.fullname || 'Member',
            type: 'sub_user' as const,
            avatar_url: su.avatar_url
          })));
        } else {
          console.log('⚠️ No sub-users found for board owner');
        }
        
        console.log('👥 Final team members list:', teamMembers.map(m => ({ name: m.name, type: m.type })));
        setMembers(teamMembers);
        
      } catch (error) {
        console.error('❌ Error loading team members:', error);
        setMembers([]);
      }
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