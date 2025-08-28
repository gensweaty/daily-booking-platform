import { useState, useEffect } from 'react';
import { Hash } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { cn } from '@/lib/utils';
import { resolveAvatarUrl } from './_avatar';

export const ChatSidebar = () => {
  const { me, boardOwnerId, currentChannelId, openChannel, startDM } = useChat();
  const location = useLocation();
  const [generalChannelId, setGeneralChannelId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ 
    id: string; 
    name: string; 
    type: 'admin' | 'sub_user'; 
    avatar_url?: string | null;
  }>>([]);

  // Load general channel with improved selection logic
  useEffect(() => {
    if (!boardOwnerId) return;
    
    (async () => {
      console.log('🔍 Loading General channel for board owner:', boardOwnerId);
      
      try {
        // Use service function for public boards to bypass RLS
        const isPublicBoard = location.pathname.startsWith('/board/');
        
        if (isPublicBoard) {
          console.log('🔍 Using service function for public board channel');
          const { data: channelData, error } = await supabase.rpc('get_default_channel_for_board', {
            p_board_owner_id: boardOwnerId
          });
          
          if (error) {
            console.error('❌ Error loading channel via service function:', error);
            return;
          }
          
          if (channelData && channelData.length > 0) {
            const channel = channelData[0];
            console.log('✅ Found General channel via service function:', {
              id: channel.id,
              name: channel.name,
              participantCount: channel.participant_count
            });
            setGeneralChannelId(channel.id);
            return;
          }
        }
        
        // Fallback to regular query for authenticated users
        const { data: channelsWithParticipants, error: participantsError } = await supabase
          .from('chat_channels')
          .select(`
            id, 
            name,
            created_at,
            chat_participants(id)
          `)
          .eq('owner_id', boardOwnerId)
          .eq('is_default', true)
          .eq('name', 'General')
          .order('created_at', { ascending: true });
        
        if (participantsError) {
          console.error('❌ Error loading General channels:', participantsError);
          return;
        }
        
        if (channelsWithParticipants && channelsWithParticipants.length > 0) {
          const sortedChannels = channelsWithParticipants.sort((a, b) => {
            const aParticipants = (a.chat_participants as any[])?.length || 0;
            const bParticipants = (b.chat_participants as any[])?.length || 0;
            
            if (aParticipants !== bParticipants) {
              return bParticipants - aParticipants;
            }
            
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          
          const selectedChannel = sortedChannels[0];
          const participantCount = (selectedChannel.chat_participants as any[])?.length || 0;
          
          console.log('✅ Selected General channel:', {
            id: selectedChannel.id,
            participantCount,
            createdAt: selectedChannel.created_at,
            totalChannels: channelsWithParticipants.length
          });
          
          setGeneralChannelId(selectedChannel.id);
          return;
        }
        
        console.log('⚠️ No General channels found');
        
      } catch (error) {
        console.error('❌ Unexpected error loading General channel:', error);
      }
    })();
  }, [boardOwnerId, location.pathname]);

  // Load team members with enhanced logic
  useEffect(() => {
    if (!boardOwnerId) {
      console.log('❌ No boardOwnerId for loading team members');
      setMembers([]);
      return;
    }
    
  console.log('👥 Loading team members for board owner:', boardOwnerId);
    console.log('🔍 Current user context for team loading:', { me, boardOwnerId });
    
    (async () => {
      try {
        const teamMembers = [];
        const isPublicBoard = location.pathname.startsWith('/board/');
        
        if (isPublicBoard) {
          console.log('🔍 Using service function for public board team members');
          const { data: memberData, error } = await supabase.rpc('get_team_members_for_board', {
            p_board_owner_id: boardOwnerId
          });
          
          if (error) {
            console.error('❌ Error loading team members via service function:', error);
          } else if (memberData && memberData.length > 0) {
            console.log('✅ Team members loaded via service function:', memberData.length, 'members');
            
            const mappedMembers = memberData.map((member: any) => ({
              id: member.id,
              name: member.name,
              type: member.type as 'admin' | 'sub_user',
              avatar_url: member.avatar_url
            }));
            
            setMembers(mappedMembers);
            return;
          }
        }
        
        // Fallback to regular queries for authenticated users
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
          console.log('⚠️ No admin profile found, creating placeholder admin');
          teamMembers.push({
            id: boardOwnerId,
            name: 'Admin',
            type: 'admin' as const,
            avatar_url: null
          });
        }
        
        // Add sub-users
        console.log('🔍 Loading sub-users for board owner:', boardOwnerId);
        const { data: subUsers, error: subUsersError } = await supabase
          .from('sub_users')
          .select('id, fullname, avatar_url, email')
          .eq('board_owner_id', boardOwnerId);
        
        if (subUsersError) {
          console.error('❌ Error loading sub-users:', subUsersError);
        } else if (subUsers && subUsers.length > 0) {
          console.log('✅ Sub-users loaded:', subUsers.length, 'users');
          teamMembers.push(...subUsers.map(su => ({
            id: su.id,
            name: su.fullname || su.email || 'Member',
            type: 'sub_user' as const,
            avatar_url: su.avatar_url
          })));
        } else {
          console.log('ℹ️ No sub-users found for board owner');
        }
        
        console.log('👥 Final team members list:', teamMembers.map(m => ({ 
          id: m.id, 
          name: m.name, 
          type: m.type 
        })));
        
        // Ensure we always have at least the admin
        if (teamMembers.length === 0) {
          console.log('⚠️ No team members found, adding fallback admin');
          teamMembers.push({
            id: boardOwnerId,
            name: 'Admin',
            type: 'admin' as const,
            avatar_url: null
          });
        }
        
        setMembers(teamMembers);
        
      } catch (error) {
        console.error('❌ Error loading team members:', error);
        // Fallback: at least show the admin
        setMembers([{
          id: boardOwnerId,
          name: 'Admin',
          type: 'admin' as const,
          avatar_url: null
        }]);
      }
    })();
  }, [boardOwnerId, location.pathname]);

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
            // Enhanced self-detection logic - only use database IDs  
            const isMe = me && (
              // Exact match by ID and type
              (member.id === me.id && member.type === me.type)
            );
            
            console.log('👤 Member filtering check:', { 
              member: { id: member.id, name: member.name, type: member.type },
              me: me ? { id: me.id, name: me.name, type: me.type } : null,
              isMe,
              shouldHide: isMe
            });
            
            if (isMe) {
              console.log('👤 ✅ Hiding self from member list:', member.name);
              return null;
            }
            
            return (
              <button
                key={`${member.type}-${member.id}`}
                onClick={async () => {
                  console.log('🖱️ Starting DM with:', { 
                    member, 
                    currentUser: me,
                    boardOwnerId 
                  });
                  
                  try {
                    await startDM(member.id, member.type);
                    console.log('✅ DM started successfully with:', member.name);
                  } catch (error) {
                    console.error('❌ Failed to start DM with:', member.name, error);
                  }
                }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-all text-left group"
                title={`Start conversation with ${member.name}`}
              >
                <div className="h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                  {resolveAvatarUrl(member.avatar_url) ? (
                    <img
                      src={resolveAvatarUrl(member.avatar_url)!}
                      alt={member.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-foreground">
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