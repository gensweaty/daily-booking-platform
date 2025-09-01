import { useState, useEffect } from 'react';
import { Hash, MessageSquare } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { cn } from '@/lib/utils';
import { resolveAvatarUrl } from './_avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface ChatSidebarProps {
  onChannelSelect?: () => void;
  onDMStart?: () => void;
}

export const ChatSidebar = ({ onChannelSelect, onDMStart }: ChatSidebarProps = {}) => {
  const { t } = useLanguage();
  const { me, boardOwnerId, currentChannelId, openChannel, startDM, unreadTotal, channelUnreads, getUserUnreadCount, channelMemberMap } = useChat();
  const location = useLocation();
  const [generalChannelId, setGeneralChannelId] = useState<string | null>(null);
  const [dmChannels, setDmChannels] = useState<Array<{
    id: string;
    name: string;
    partner_name: string;
    partner_avatar?: string;
    partner_type: 'admin' | 'sub_user';
  }>>([]);
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

  // Load DM channels with proper filtering for sub-users
  useEffect(() => {
    if (!boardOwnerId || !me) return;
    
    (async () => {
      try {
        const { data: channels } = await supabase
          .from('chat_channels')
          .select(`
            id, name, is_dm,
            chat_participants ( user_id, sub_user_id, user_type )
          `)
          .eq('owner_id', boardOwnerId)
          .eq('is_dm', true);

        if (!channels) {
          setDmChannels([]);
          return;
        }

        const isSub = me?.type === 'sub_user';
        const mySubId = me?.id;
        const isPublicBoard = location.pathname.startsWith('/board/');

        const validDMs = channels.filter(ch => {
          const ps = ch.chat_participants ?? [];
          
          // For internal boards (dashboard), admins see all DMs without restriction
          if (!isSub && !isPublicBoard) return true;
          
          // For external boards or sub-users: filter DMs properly
          if (isSub) {
            // Sub-users only see DMs with exactly 2 participants (admin + this sub-user)
            const hasAdmin = ps.some(p => p.user_type === 'admin' && p.user_id);
            const hasMe = ps.some(p => p.sub_user_id === mySubId);
            return ps.length === 2 && hasAdmin && hasMe;
          }
          
          return true; // Fallback
        });

        const dmList = await Promise.all(
          validDMs.map(async ch => {
            const ps = ch.chat_participants ?? [];
            const other = isSub 
              ? ps.find((p: any) => p.user_type === 'admin')
              : ps.find((p: any) => p.user_type === 'sub_user');

            let partnerName = 'Direct Message';
            let partnerAvatar = '';
            let partnerType: 'admin' | 'sub_user' = 'admin';

            if (other) {
              partnerType = other.user_type as 'admin' | 'sub_user';
              if (other.user_type === 'admin' && other.user_id) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('username, avatar_url')
                  .eq('id', other.user_id)
                  .maybeSingle();
                partnerName = profile?.username?.startsWith('user_') ? 'Admin' : (profile?.username || 'Admin');
                partnerAvatar = profile?.avatar_url || '';
              } else if (other.user_type === 'sub_user' && other.sub_user_id) {
                const { data: subUser } = await supabase
                  .from('sub_users')
                  .select('fullname, avatar_url')
                  .eq('id', other.sub_user_id)
                  .maybeSingle();
                partnerName = subUser?.fullname || 'Member';
                partnerAvatar = subUser?.avatar_url || '';
              }
            }

            return {
              id: ch.id,
              name: ch.name,
              partner_name: partnerName,
              partner_avatar: partnerAvatar,
              partner_type: partnerType
            };
          })
        );

        setDmChannels(dmList);
      } catch (error) {
        console.error('Error loading DM channels:', error);
        setDmChannels([]);
      }
    })();
  }, [boardOwnerId, me?.id, me?.type]);

  return (
    <div className="w-full h-full bg-muted/20 p-4 overflow-y-auto">
      <div className="space-y-2">
        {/* General Channel */}
        <button
          onClick={() => {
            if (generalChannelId) {
              openChannel(generalChannelId);
              onChannelSelect?.();
            }
          }}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/70 transition-all text-left relative group",
            currentChannelId === generalChannelId ? "bg-primary/15 text-primary border border-primary/20" : "border border-transparent"
          )}
        >
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">
              <LanguageText>{t('chat.general')}</LanguageText>
            </span>
          </div>
          {generalChannelId && (channelUnreads[generalChannelId] ?? 0) > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
              {(channelUnreads[generalChannelId] ?? 0) > 99 ? '99+' : channelUnreads[generalChannelId]}
            </span>
          )}
        </button>

        {/* DM Channels */}
        {dmChannels.length > 0 && (
          <div className="pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-wide">
              Direct Messages
            </p>
            {dmChannels.map((dm) => (
              <button
                key={dm.id}
                onClick={() => {
                  openChannel(dm.id);
                  onChannelSelect?.();
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/70 transition-all text-left relative group",
                  currentChannelId === dm.id ? "bg-primary/15 text-primary border border-primary/20" : "border border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {resolveAvatarUrl(dm.partner_avatar) ? (
                      <img
                        src={resolveAvatarUrl(dm.partner_avatar)!}
                        alt={dm.partner_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold">
                        {dm.partner_name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-sm truncate">{dm.partner_name}</span>
                </div>
                {(channelUnreads[dm.id] ?? 0) > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {(channelUnreads[dm.id] ?? 0) > 99 ? '99+' : channelUnreads[dm.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Team Members */}
        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-wide">
            <LanguageText>{t('chat.teamMembers')}</LanguageText>
          </p>
          
          {members.map((member) => {
            const isMe = !!me && member.id === me.id && member.type === me.type;
            const peerUnread = getUserUnreadCount(member.id, member.type);
            
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
                    onDMStart?.();
                    console.log('✅ DM started successfully with:', member.name);
                  } catch (error) {
                    console.error('❌ Failed to start DM with:', member.name, error);
                  }
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/70 transition-all text-left relative group",
                  "border border-transparent hover:border-muted"
                )}
                title={`Start conversation with ${member.name}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                    {resolveAvatarUrl(member.avatar_url) ? (
                      <img
                        src={resolveAvatarUrl(member.avatar_url)!}
                        alt={member.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-foreground">
                        {(member.name || "U").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      <LanguageText>
                        {member.type === 'admin' ? t('chat.owner') : t('chat.teamMember')}
                      </LanguageText>
                    </p>
                  </div>
                </div>
                
                {peerUnread > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {peerUnread > 99 ? '99+' : peerUnread}
                  </span>
                )}
              </button>
            );
          })}
          
          {members.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-4">
              <LanguageText>{t('chat.noTeamMembers')}</LanguageText>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
