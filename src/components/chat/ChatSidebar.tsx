import { useState, useEffect } from 'react';
import { Hash } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { cn } from '@/lib/utils';
import { resolveAvatarUrl } from './_avatar';

export const ChatSidebar = () => {
  const { me, boardOwnerId, currentChannelId, openChannel, startDM, unreadTotal, channelUnreads, getUserUnreadCount } = useChat();
  const location = useLocation();
  const [generalChannelId, setGeneralChannelId] = useState<string | null>(null);
  const [channelMemberMap, setChannelMemberMap] = useState<Map<string, { id: string; type: 'admin' | 'sub_user' }>>(new Map());
  const [members, setMembers] = useState<Array<{ 
    id: string; 
    name: string; 
    type: 'admin' | 'sub_user'; 
    avatar_url?: string | null;
    unreadCount?: number;
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
            setMembers([{ id: boardOwnerId, name: 'Admin', type: 'admin', avatar_url: null }]);
            return;
          }

          if (!memberData || memberData.length === 0) {
            setMembers([{ id: boardOwnerId, name: 'Admin', type: 'admin', avatar_url: null }]);
            return;
          }

          if (memberData && memberData.length > 0) {
            console.log('✅ Team members loaded via service function:', memberData.length, 'members');
            
            const mappedMembers = memberData.map((member: any) => {
              // Enhanced name resolution with multiple fallbacks
              const resolvedName = member.name || 
                (member.type === 'admin' ? 'Admin' : 'Member');
              
              console.log('👤 Mapping member:', { 
                original: member, 
                resolved: { ...member, name: resolvedName } 
              });
              
              return {
                id: member.id,
                name: resolvedName,
                type: member.type as 'admin' | 'sub_user',
                avatar_url: member.avatar_url
              };
            });
            
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
          // Enhanced admin name resolution 
          const adminName = adminProfile.username?.startsWith('user_') 
            ? 'Admin' // Don't show auto-generated usernames
            : (adminProfile.username || 'Admin');
            
          console.log('✅ Admin profile loaded:', { 
            username: adminProfile.username, 
            resolvedName: adminName 
          });
          
          teamMembers.push({
            id: adminProfile.id,
            name: adminName,
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

  // Enhanced DM channel mapping - proper PEER-TO-PEER identification
  useEffect(() => {
    if (!boardOwnerId || !channelUnreads || !me) return;

    console.log('🔄 Building enhanced PEER-TO-PEER channel-member mapping...');
    
    (async () => {
      try {
        const { data: dmChannels } = await supabase
          .from('chat_channels')
          .select(`
            id,
            is_dm,
            participants,
            chat_participants(user_id, sub_user_id, user_type)
          `)
          .eq('owner_id', boardOwnerId)
          .eq('is_dm', true);

        if (dmChannels) {
          const newChannelMemberMap = new Map();
          
          dmChannels.forEach((channel: any) => {
            const participants = channel.chat_participants || [];
            console.log(`🔍 Processing PEER-TO-PEER DM channel ${channel.id}:`, {
              participantCount: participants.length,
              participants: participants.map((p: any) => ({
                userId: p.user_id,
                subUserId: p.sub_user_id,
                userType: p.user_type
              }))
            });
            
            // For PEER-TO-PEER DMs, we expect exactly 2 participants
            if (participants.length !== 2) {
              console.log(`⏭️ Skipping channel ${channel.id} - not exactly 2 participants (has ${participants.length})`);
              return;
            }

            // Find the OTHER participant (not me)
            const myId = me.id;
            const myType = me.type;
            
            const otherParticipant = participants.find((p: any) => {
              // Skip if this is me
              if (myType === 'admin' && p.user_type === 'admin' && p.user_id === myId) return false;
              if (myType === 'sub_user' && p.user_type === 'sub_user' && p.sub_user_id === myId) return false;
              // Return the other participant
              return true;
            });

            if (otherParticipant) {
              const memberId = otherParticipant.user_id || otherParticipant.sub_user_id;
              const memberType = otherParticipant.user_type as 'admin' | 'sub_user';
              
              if (memberId && memberType) {
                console.log(`✅ Mapped PEER-TO-PEER DM channel ${channel.id} to member:`, { 
                  memberId, 
                  memberType,
                  unreadCount: channelUnreads[channel.id] || 0
                });
                
                newChannelMemberMap.set(channel.id, { 
                  id: memberId, 
                  type: memberType 
                });
              }
            } else {
              console.log(`❌ Could not identify other participant in PEER-TO-PEER DM ${channel.id}`);
            }
          });
          
          console.log('🗺️ Final PEER-TO-PEER channel-member map:', Array.from(newChannelMemberMap.entries()));
          setChannelMemberMap(newChannelMemberMap);
        }
      } catch (error) {
        console.error('❌ Error loading PEER-TO-PEER channel-member mapping:', error);
      }
    })();
  }, [boardOwnerId, me, channelUnreads]);

  // Enhanced unread count indicators with detailed logging
  useEffect(() => {
    console.log('🔄 Updating member unread count indicators...');
    
    setMembers(prevMembers => 
      prevMembers.map(member => {
        const unreadCount = getUserUnreadCount(member.id, member.type);
        
        if (unreadCount !== member.unreadCount) {
          console.log(`📍 Member ${member.name} unread count changed:`, { 
            from: member.unreadCount, 
            to: unreadCount 
          });
        }

        return {
          ...member,
          unreadCount
        };
      })
    );
  }, [getUserUnreadCount]);

  return (
    <div className="w-full h-full bg-muted/20 p-4 overflow-y-auto">
      <div className="space-y-2">
        {/* General Channel */}
        <button
          onClick={() => generalChannelId && openChannel(generalChannelId)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted/50 transition-colors text-left relative",
            currentChannelId === generalChannelId ? "bg-primary/10 text-primary" : ""
          )}
        >
          <Hash className="h-4 w-4" />
          <span className="font-medium">General</span>
          {generalChannelId && channelUnreads[generalChannelId] > 0 && (
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full border-2 border-background flex items-center justify-center">
              <span className="text-xs text-white font-bold">
                {channelUnreads[generalChannelId] > 9 ? '9+' : channelUnreads[generalChannelId]}
              </span>
            </div>
          )}
        </button>

        {/* Team Members */}
        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-wide">
            Team Members
          </p>
          
          {members.map((member) => {
            const isMe = !!me && member.id === me.id && member.type === me.type;
            
            if (isMe) {
              return null;
            }
            
            return (
              <button
                key={`${member.type}-${member.id}`}
                onClick={async () => {
                  console.log('🖱️ Starting DM with:', { 
                    member, 
                    currentUser: me,
                    boardOwnerId,
                    isPublicBoard: location.pathname.startsWith('/board/')
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
                <div className="relative h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
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
                  {member.unreadCount && member.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full border-2 border-background flex items-center justify-center">
                      <span className="text-xs text-white font-bold">
                        {member.unreadCount > 9 ? '9+' : member.unreadCount}
                      </span>
                    </div>
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