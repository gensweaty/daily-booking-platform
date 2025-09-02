import { useState, useEffect, useMemo } from 'react';
import { Hash } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

interface ChatSidebarProps {
  onChannelSelect?: () => void;
  onDMStart?: () => void;
}

export const ChatSidebar = ({ onChannelSelect, onDMStart }: ChatSidebarProps = {}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { me, boardOwnerId, currentChannelId, openChannel, startDM, unreadTotal, channelUnreads, getUserUnreadCount, channelMemberMap } = useChat();
  const location = useLocation();
  const isPublicBoard = location.pathname.startsWith('/board/');
  const publicAccess = useMemo(() => {
    if (!isPublicBoard) return {};
    const slug = location.pathname.split('/').pop()!;
    try { return JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}') || {}; }
    catch { return {}; }
  }, [location.pathname, isPublicBoard]);
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

        {/* Team Members */}
        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2 uppercase tracking-wide">
            <LanguageText>{t('chat.teamMembers')}</LanguageText>
          </p>
          
          {members.map((member) => {
            // Robust "is me" detection
            let isMe = !!me && member.id === (me as any)?.id && member.type === (me as any)?.type;
            if (isPublicBoard && (me as any)?.type === 'sub_user') {
              const myName = (me as any)?.name || publicAccess?.external_user_name;
              const myEmail = (me as any)?.email || publicAccess?.external_user_email;
              if (member.type === 'sub_user') {
                // hide if names match OR if member.name is the email we stored earlier
                if (member.name && myName && member.name.trim() === String(myName).trim()) isMe = true;
                if (!isMe && member.name && myEmail && member.name.trim() === String(myEmail).trim()) isMe = true;
              }
            }
            
            const peerUnread = getUserUnreadCount(member.id, member.type);
            
            // Hide current user from the list
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
                    if (isPublicBoard && (me as any)?.type === 'sub_user') {
                      // Public board sub-user path: use public RPC and sender email
                      console.log('🔍 Public board sub-user DM creation starting...');
                      
                      const senderEmail =
                        (me as any)?.email
                        || publicAccess?.external_user_email
                        || publicAccess?.email;
                        
                      console.log('🔍 Sender email resolved:', senderEmail);
                      console.log('🔍 Public access data:', publicAccess);
                      console.log('🔍 Me object:', me);
                      
                      // Enhanced parameter validation
                      if (!boardOwnerId) {
                        console.error('❌ Missing board owner ID for public DM');
                        throw new Error('Board owner not found. Please refresh and try again.');
                      }
                      
                      if (!senderEmail || typeof senderEmail !== 'string' || !senderEmail.includes('@')) {
                        console.error('❌ Invalid sender email for public DM:', senderEmail);
                        throw new Error('Your email could not be verified. Please refresh and try again.');
                      }
                      
                      if (!member.id || typeof member.id !== 'string') {
                        console.error('❌ Invalid member ID for public DM:', member.id);
                        throw new Error('Invalid team member selected. Please try again.');
                      }
                      
                      if (!member.type || !['admin', 'sub_user'].includes(member.type)) {
                        console.error('❌ Invalid member type for public DM:', member.type);
                        throw new Error('Invalid team member type. Please try again.');
                      }
                      
                      console.log('🔍 Calling start_public_board_dm with params:', {
                        p_board_owner_id: boardOwnerId,
                        p_other_id: member.id,
                        p_other_type: member.type,
                        p_sender_email: senderEmail,
                      });
                      
                      const { data: channelId, error } = await supabase.rpc('start_public_board_dm', {
                        p_board_owner_id: boardOwnerId,
                        p_other_id: member.id,
                        p_other_type: member.type,
                        p_sender_email: senderEmail,
                      });
                      
                      if (error) {
                        console.error('❌ RPC error starting public DM:', error);
                        // Provide specific error messages based on common issues
                        if (error.message?.includes('Unknown public sub-user')) {
                          throw new Error('Your account is not authorized for this board. Please contact the board owner.');
                        } else if (error.message?.includes('Invalid channel')) {
                          throw new Error('Cannot create chat channel. Please try again later.');
                        } else if (error.message?.includes('not found')) {
                          throw new Error('The selected team member is no longer available. Please refresh and try again.');
                        } else {
                          throw new Error(`Chat setup failed: ${error.message || 'Unknown error'}`);
                        }
                      }
                      
                      if (!channelId || typeof channelId !== 'string') {
                        console.error('❌ Invalid channel ID returned from public DM creation:', channelId);
                        throw new Error('Failed to create chat channel. Please try again.');
                      }
                      
                      console.log('✅ Public DM channel created:', channelId);
                      
                      // Robust channel opening with validation
                      try {
                        await openChannel(channelId);
                        onDMStart?.();
                        console.log('✅ Public DM started successfully with:', member.name);
                      } catch (channelError) {
                        console.error('❌ Failed to open channel:', channelError);
                        throw new Error('Chat channel created but could not be opened. Please refresh and try again.');
                      }
                    } else {
                      console.log('🔍 Using internal/authenticated DM path');
                      // Internal/authenticated path unchanged
                      await startDM(member.id, member.type);
                      onDMStart?.();
                      console.log('✅ DM started successfully with:', member.name);
                    }
                  } catch (error) {
                    console.error('❌ Failed to start DM with:', member.name, error);
                    
                    // Show specific error messages to help users understand what went wrong
                    const errorMessage = error instanceof Error ? error.message : `Failed to start chat with ${member.name}. Please try again.`;
                    
                    // Use toast for better UX instead of alert
                    toast({
                      variant: "destructive",
                      title: "Chat Error",
                      description: errorMessage,
                    });
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
