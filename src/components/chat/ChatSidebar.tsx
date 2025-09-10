import { useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Hash, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { resolveAvatarUrl } from './_avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreateCustomChatDialog } from './CreateCustomChatDialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatSidebarProps {
  onChannelSelect?: () => void;
  onDMStart?: () => void;
}

export const ChatSidebar = ({ onChannelSelect, onDMStart }: ChatSidebarProps = {}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { me, boardOwnerId, currentChannelId, openChannel, startDM, unreadTotal, channelUnreads, getUserUnreadCount, channelMemberMap, isChannelRecentlyCleared, isPeerRecentlyCleared, suppressChannelBadge, suppressPeerBadge, isChannelBadgeSuppressed, isPeerBadgeSuppressed } = useChat();
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
  const [customChats, setCustomChats] = useState<Array<{
    id: string;
    name: string;
    created_by_type: string;
    created_by_id: string;
  }>>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<{ id: string; name: string } | null>(null);

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

  // Load custom chats
  const loadCustomChats = async () => {
    if (!boardOwnerId || !me) {
      console.log('🚫 Cannot load custom chats - missing:', { boardOwnerId, me });
      return;
    }

    console.log('🔍 Loading custom chats for:', { boardOwnerId, me: me.type, meId: me.id });

    try {
      // Build membership filter for current user - fix PostgREST syntax
      let membershipQuery;
      if (me.type === 'admin') {
        membershipQuery = supabase
          .from('chat_channels')
          .select(`
            id, name, is_custom, is_deleted, created_by_type, created_by_id,
            chat_participants!inner(user_type, user_id, sub_user_id)
          `)
          .eq('owner_id', boardOwnerId)
          .eq('is_custom', true)
          .eq('is_deleted', false)
          .eq('chat_participants.user_type', 'admin')
          .eq('chat_participants.user_id', me.id)
          .order('name', { ascending: true });
      } else {
        // For sub-users, resolve the actual sub-user ID if needed
        let actualSubUserId = me.id;
        if (typeof me.id === 'string' && me.id.includes('@')) {
          console.log('🔍 Resolving sub-user ID for email:', me.id);
          const { data: subUser } = await supabase
            .from('sub_users')
            .select('id')
            .eq('board_owner_id', boardOwnerId)
            .eq('email', me.email || me.id)
            .maybeSingle();
          
          if (subUser?.id) {
            actualSubUserId = subUser.id;
            console.log('✅ Resolved sub-user ID:', actualSubUserId);
          } else {
            console.log('❌ Could not resolve sub-user ID for email:', me.id);
          }
        }

        membershipQuery = supabase
          .from('chat_channels')
          .select(`
            id, name, is_custom, is_deleted, created_by_type, created_by_id,
            chat_participants!inner(user_type, user_id, sub_user_id)
          `)
          .eq('owner_id', boardOwnerId)
          .eq('is_custom', true)
          .eq('is_deleted', false)
          .eq('chat_participants.user_type', 'sub_user')
          .eq('chat_participants.sub_user_id', actualSubUserId)
          .order('name', { ascending: true });
      }

      const { data: customChats, error } = await membershipQuery;

      if (error) {
        console.error('❌ Error loading custom chats:', error);
        return;
      }

      console.log('✅ Custom chats loaded:', customChats);
      console.log('📊 Custom chats count:', customChats?.length || 0);
      setCustomChats(customChats || []);

    } catch (error) {
      console.error('❌ Error loading custom chats:', error);
    }
  };

  // Delete custom chat (creator only)
  const handleDeleteCustomChat = async (channelId: string) => {
    if (!me || !boardOwnerId || !chatToDelete) return;

    try {
      // Resolve requester ID for sub-users if needed
      let requesterId = me.id;
      if (me.type === 'sub_user' && typeof me.id === 'string' && me.id.includes('@')) {
        const { data: subUser } = await supabase
          .from('sub_users')
          .select('id')
          .eq('board_owner_id', boardOwnerId)
          .eq('email', me.email || me.id)
          .maybeSingle();
        
        if (subUser?.id) {
          requesterId = subUser.id;
        }
      }

      const { error } = await supabase.rpc('delete_custom_chat', {
        p_owner_id: boardOwnerId,
        p_channel_id: chatToDelete.id,
        p_requester_type: me.type,
        p_requester_id: requesterId
      });

      if (error) {
        console.error('❌ Error deleting custom chat:', error);
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ Custom chat deleted successfully');
      
      // Refresh custom chats list
      await loadCustomChats();
      
      // If this was the current channel, switch to general
      if (currentChannelId === channelId) {
        if (generalChannelId) {
          openChannel(generalChannelId);
        }
      }

      toast({
        title: 'Success',
        description: 'Custom chat deleted successfully',
      });

    } catch (error) {
      console.error('❌ Error deleting custom chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete chat. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Check if current user is creator of a custom chat
  const isCreator = (chat: any) => {
    return chat.created_by_type === me?.type && chat.created_by_id === me?.id;
  };

  // Load custom chats when dependencies change
  useEffect(() => {
    console.log('🔄 Custom chats effect triggered:', { boardOwnerId, me: me?.id, meType: me?.type });
    if (boardOwnerId && me) {
      console.log('🔄 Calling loadCustomChats...');
      loadCustomChats();
    } else {
      console.log('🚫 Not loading custom chats - missing dependencies');
    }
  }, [boardOwnerId, me?.id, me?.type]);

  // Real-time subscription for custom chats and participants
  useEffect(() => {
    if (!boardOwnerId || !me) {
      console.log('🚫 Skipping real-time subscription - missing dependencies');
      return;
    }

    console.log('🔄 Setting up real-time subscriptions for custom chats');

    // Subscribe to changes in chat_channels (new custom chats)
    const channelsChannel = supabase
      .channel(`custom-chats-${boardOwnerId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_channels',
        filter: `owner_id=eq.${boardOwnerId}`
      }, (payload) => {
        console.log('🔄 Chat channels change detected:', payload);
        if (payload.eventType === 'INSERT' && payload.new.is_custom) {
          console.log('🆕 New custom chat created, refreshing list in 1 second...');
          // Small delay to ensure participants are added
          setTimeout(() => {
            loadCustomChats();
          }, 1000);
        } else if (payload.eventType === 'DELETE' || (payload.eventType === 'UPDATE' && payload.new.is_deleted)) {
          console.log('🗑️ Custom chat deleted, refreshing list...');
          loadCustomChats();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public', 
        table: 'chat_participants'
      }, (payload) => {
        console.log('🔄 Chat participants change detected:', payload);
        
        // Check if this participant change affects the current user
        const isRelevant = (payload.eventType === 'INSERT' && (
          (me.type === 'admin' && payload.new.user_id === me.id) ||
          (me.type === 'sub_user' && payload.new.sub_user_id === me.id)
        )) || (payload.eventType === 'DELETE' && (
          (me.type === 'admin' && payload.old?.user_id === me.id) ||
          (me.type === 'sub_user' && payload.old?.sub_user_id === me.id)
        ));

        if (isRelevant) {
          console.log('👤 Participant change affects current user, refreshing custom chats in 500ms...');
          setTimeout(() => {
            loadCustomChats();
          }, 500);
        }
      })
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up real-time subscriptions for custom chats');
      supabase.removeChannel(channelsChannel);
    };
  }, [boardOwnerId, me?.id, me?.type, loadCustomChats]);

  return (
    <div className="w-full h-full bg-muted/20 p-4 overflow-y-auto">
      <div className="space-y-2">
        {/* General Channel */}
        <button
          onPointerDown={() => {
            if (generalChannelId) flushSync(() => suppressChannelBadge(generalChannelId));
          }}
          onClick={() => {
            if (generalChannelId) {
              // Tell the header explicitly: this is a Channel called "General"
              window.dispatchEvent(new CustomEvent('chat-header', {
                detail: {
                  channelId: generalChannelId,
                  isDM: false,
                  title: 'General',
                  avatar: null
                }
              }));
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
          {generalChannelId && 
           currentChannelId !== generalChannelId &&
           (channelUnreads[generalChannelId] ?? 0) > 0 && 
           !isChannelRecentlyCleared(generalChannelId) && 
           !isChannelBadgeSuppressed(generalChannelId) && (
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
                      
                      // Helper function to extract channel ID from various return formats
                      const extractChannelId = (data: any): string | null => {
                        if (!data) return null;
                        if (typeof data === 'string') return data;
                        if (Array.isArray(data) && data.length) {
                          const f = data[0]; 
                          if (f?.id) return f.id; 
                          if (f?.channel_id) return f.channel_id;
                        }
                        if (typeof data === 'object') {
                          if ('id' in data && data.id) return data.id as string;
                          if ('channel_id' in data && data.channel_id) return data.channel_id as string;
                        }
                        return null;
                      };

                      const { data, error } = await supabase.rpc('start_public_board_dm', {
                        p_board_owner_id: boardOwnerId,
                        p_sender_email: senderEmail,
                        p_target_type: member.type,
                        p_target_id: member.id,
                      });
                      
                      const channelId = extractChannelId(data);
                      
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
                        window.dispatchEvent(new CustomEvent('chat-header', {
                          detail: {
                            channelId,
                            isDM: true,
                            title: member.name,
                            avatar: member.avatar_url
                          }
                        }));
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
                      // Tell the header explicitly who this DM is with
                      window.dispatchEvent(new CustomEvent('chat-header', {
                        detail: {
                          // channelId might not be known synchronously; header accepts missing channelId
                          isDM: true,
                          title: member.name,
                          avatar: member.avatar_url
                        }
                      }));
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
                
                {peerUnread > 0 && !isPeerRecentlyCleared(member.id, member.type) && !isPeerBadgeSuppressed(member.id, member.type) && (
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

        {/* Custom Chats */}
        <div className="pt-4">
          <div className="flex items-center justify-between mb-2 px-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <LanguageText>{t('chat.customChats')}</LanguageText>
            </p>
            <CreateCustomChatDialog 
              teamMembers={members} 
              onChatCreated={loadCustomChats} 
            />
          </div>

          <ScrollArea className="max-h-48 overflow-y-auto">
            <div className="space-y-1">
              {customChats.map((chat) => (
                <div key={chat.id} className="group flex items-center">
                  <button
                    onPointerDown={() => flushSync(() => suppressChannelBadge(chat.id))}
                    onClick={() => {
                      // Tell the header this is a custom channel
                      window.dispatchEvent(new CustomEvent('chat-header', {
                        detail: {
                          channelId: chat.id,
                          isDM: false,
                          title: chat.name,
                          avatar: null
                        }
                      }));
                      openChannel(chat.id);
                      onChannelSelect?.();
                    }}
                    className={cn(
                      "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/70 transition-all text-left",
                      currentChannelId === chat.id ? "bg-primary/15 text-primary border border-primary/20" : "border border-transparent"
                    )}
                  >
                    <Hash className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium truncate">{chat.name}</span>
                    
                    {chat.id && currentChannelId !== chat.id && (channelUnreads[chat.id] ?? 0) > 0 && !isChannelRecentlyCleared(chat.id) && !isChannelBadgeSuppressed(chat.id) && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground ml-auto">
                        {(channelUnreads[chat.id] ?? 0) > 99 ? '99+' : channelUnreads[chat.id]}
                      </span>
                    )}
                  </button>
                  
                  {/* Delete button - only show for creator */}
                  {isCreator(chat) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatToDelete({ id: chat.id, name: chat.name });
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      <span className="sr-only">Delete chat</span>
                    </Button>
                  )}
                </div>
              ))}
              
              {customChats.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-4">
                  <LanguageText>{t('chat.noCustomChats')}</LanguageText>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="z-[10000] fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <LanguageText>{t('chat.deleteChatConfirmTitle')}</LanguageText>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <LanguageText>{t('chat.deleteChatConfirmMessage')}</LanguageText>
              {chatToDelete && (
                <div className="mt-2 p-2 bg-muted rounded text-sm font-medium">
                  "{chatToDelete.name}"
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setChatToDelete(null);
            }}>
              <LanguageText>{t('common.cancel')}</LanguageText>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteCustomChat(chatToDelete?.id || '')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <LanguageText>{t('chat.deleteChat')}</LanguageText>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
