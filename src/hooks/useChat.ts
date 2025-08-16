import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicBoardAuth } from '@/contexts/PublicBoardAuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ChatChannel {
  id: string;
  owner_id: string;
  name: string;
  emoji: string;
  is_default: boolean;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_user_id?: string;
  sender_sub_user_id?: string;
  sender_type: 'admin' | 'sub_user';
  content: string;
  reply_to_id?: string;
  created_at: string;
  updated_at: string;
  sender_name?: string;
  sender_avatar?: string;
  reactions?: ChatReaction[];
  reply_to?: ChatMessage;
  files?: ChatFile[];
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id?: string;
  sub_user_id?: string;
  user_type: 'admin' | 'sub_user';
  emoji: string;
  created_at: string;
  sender_name?: string;
}

export interface ChatFile {
  id: string;
  message_id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  created_at: string;
}

export interface ChatParticipant {
  id: string;
  channel_id: string;
  user_id?: string;
  sub_user_id?: string;
  user_type: 'admin' | 'sub_user';
  joined_at: string;
  name: string;
  avatar?: string;
}

export const useChat = () => {
  const { user } = useAuth();
  const { user: publicBoardUser, isPublicBoard } = usePublicBoardAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [subUsers, setSubUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSubUsers, setHasSubUsers] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Determine the effective user and board owner
  const effectiveUser = isPublicBoard ? publicBoardUser : user;
  const boardOwnerId = isPublicBoard ? publicBoardUser?.boardOwnerId : user?.id;

  // Check if user has sub-users (required for chat to show)
  const checkSubUsers = useCallback(async () => {
    if (!effectiveUser || !boardOwnerId) {
      setHasSubUsers(false);
      setIsInitialized(true);
      console.log('🔍 No effective user or board owner ID, setting hasSubUsers to false, initialized');
      return;
    }
    
    console.log('🔍 Checking sub-users for board owner:', boardOwnerId, 'isPublicBoard:', isPublicBoard);
    
    try {
      const { data, error } = await supabase
        .from('sub_users')
        .select('*')
        .eq('board_owner_id', boardOwnerId);

      console.log('🔍 Sub-users query result:', { data, error, count: data?.length || 0, boardOwnerId });

      if (error) throw error;
      
      setSubUsers(data || []);
      const hasUsers = (data || []).length > 0;
      setHasSubUsers(hasUsers);
      setIsInitialized(true);
      console.log('🔍 Set hasSubUsers to:', hasUsers, 'with', data?.length || 0, 'sub-users, initialized');
    } catch (error) {
      console.error('❌ Error checking sub users:', error);
      setHasSubUsers(false);
      setIsInitialized(true);
    }
  }, [effectiveUser, boardOwnerId, isPublicBoard]);

  // Load channels for current user
  const loadChannels = useCallback(async () => {
    if (!effectiveUser || !hasSubUsers || !boardOwnerId) return;

    console.log('🔍 Loading channels for board owner:', boardOwnerId, 'hasSubUsers:', hasSubUsers);

    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('owner_id', boardOwnerId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      console.log('🔍 Channels query result:', { data, error });

      if (error) {
        console.error('❌ Error loading channels:', error);
        throw error;
      }
      
      setChannels(data || []);
      
      // Set default channel if none selected
      if (!currentChannel && data && data.length > 0) {
        const defaultChannel = data.find(c => c.is_default) || data[0];
        setCurrentChannel(defaultChannel);
        console.log('🔍 Set default channel:', defaultChannel);
      }
    } catch (error) {
      console.error('❌ Error loading channels:', error);
      toast({
        title: "Error",
        description: "Failed to load chat channels",
        variant: "destructive"
      });
    }
  }, [effectiveUser, hasSubUsers, currentChannel, toast, boardOwnerId]);

  // Load messages for current channel
  const loadMessages = useCallback(async () => {
    if (!currentChannel) return;

    setLoading(true);
    try {
      // Load messages with sender info
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select(`
          *,
          reply_to:chat_messages!reply_to_id(
            id, content, sender_user_id, sender_sub_user_id, sender_type, created_at
          )
        `)
        .eq('channel_id', currentChannel.id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Enrich messages with sender info and reactions
      const enrichedMessages = await Promise.all(
        (messagesData || []).map(async (message) => {
          // Get sender info
          let senderName = 'Unknown';
          let senderAvatar = null;

          if (message.sender_type === 'admin' && message.sender_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', message.sender_user_id)
              .single();
            senderName = profile?.username || 'Admin';
            senderAvatar = profile?.avatar_url;
          } else if (message.sender_type === 'sub_user' && message.sender_sub_user_id) {
            const subUser = subUsers.find(su => su.id === message.sender_sub_user_id);
            senderName = subUser?.fullname || 'Sub User';
            senderAvatar = subUser?.avatar_url;
          }

          // Get reactions
          const { data: reactions } = await supabase
            .from('chat_message_reactions')
            .select('*')
            .eq('message_id', message.id);

          // Get files
          const { data: files } = await supabase
            .from('chat_message_files')
            .select('*')
            .eq('message_id', message.id);

          // Process reply_to (it comes as an array from the join, take first element)
          const replyTo = Array.isArray(message.reply_to) && message.reply_to.length > 0 
            ? {
                ...message.reply_to[0],
                sender_type: message.reply_to[0].sender_type as 'admin' | 'sub_user'
              } as ChatMessage
            : undefined;

          return {
            id: message.id,
            channel_id: message.channel_id,
            sender_user_id: message.sender_user_id || undefined,
            sender_sub_user_id: message.sender_sub_user_id || undefined,
            sender_type: message.sender_type as 'admin' | 'sub_user',
            content: message.content,
            reply_to_id: message.reply_to_id || undefined,
            created_at: message.created_at,
            updated_at: message.updated_at,
            sender_name: senderName,
            sender_avatar: senderAvatar,
            reactions: (reactions || []).map(r => ({
              id: r.id,
              message_id: r.message_id,
              user_id: r.user_id || undefined,
              sub_user_id: r.sub_user_id || undefined,
              user_type: r.user_type as 'admin' | 'sub_user',
              emoji: r.emoji,
              created_at: r.created_at,
              sender_name: senderName
            })),
            reply_to: replyTo,
            files: files || []
          };
        })
      );

      setMessages(enrichedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [currentChannel, subUsers, toast]);

  // Load participants for current channel
  const loadParticipants = useCallback(async () => {
    if (!currentChannel) return;

    try {
      const { data, error } = await supabase
        .from('chat_participants')
        .select('*')
        .eq('channel_id', currentChannel.id);

      if (error) throw error;

      // Enrich with names and avatars
      const enrichedParticipants = await Promise.all(
        (data || []).map(async (participant) => {
          let name = 'Unknown';
          let avatar = null;

          if (participant.user_type === 'admin' && participant.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', participant.user_id)
              .single();
            name = profile?.username || 'Admin';
            avatar = profile?.avatar_url;
          } else if (participant.user_type === 'sub_user' && participant.sub_user_id) {
            const subUser = subUsers.find(su => su.id === participant.sub_user_id);
            name = subUser?.fullname || 'Sub User';
            avatar = subUser?.avatar_url;
          }

          return {
            ...participant,
            user_type: participant.user_type as 'admin' | 'sub_user',
            name,
            avatar
          } as ChatParticipant;
        })
      );

      setParticipants(enrichedParticipants);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  }, [currentChannel, subUsers]);

  // Send a message
  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    if (!effectiveUser || !currentChannel || !content.trim() || !boardOwnerId) return;

    try {
      // Determine sender info based on context
      let senderUserId = null;
      let senderSubUserId = null;
      let senderType: 'admin' | 'sub_user' = 'admin';

      if (isPublicBoard && publicBoardUser) {
        // On public board, find the sub-user ID
        const subUser = subUsers.find(su => su.email.toLowerCase() === publicBoardUser.email.toLowerCase());
        if (subUser) {
          senderSubUserId = subUser.id;
          senderType = 'sub_user';
        }
      } else if (user) {
        senderUserId = user.id;
        senderType = 'admin';
      }

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: currentChannel.id,
          sender_user_id: senderUserId,
          sender_sub_user_id: senderSubUserId,
          sender_type: senderType,
          content: content.trim(),
          reply_to_id: replyToId
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  }, [effectiveUser, currentChannel, toast, boardOwnerId, isPublicBoard, publicBoardUser, subUsers, user]);

  // Add reaction to message
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!effectiveUser) return;

    try {
      // Determine sender info based on context
      let userId = null;
      let subUserId = null;
      let userType: 'admin' | 'sub_user' = 'admin';

      if (isPublicBoard && publicBoardUser) {
        const subUser = subUsers.find(su => su.email.toLowerCase() === publicBoardUser.email.toLowerCase());
        if (subUser) {
          subUserId = subUser.id;
          userType = 'sub_user';
        }
      } else if (user) {
        userId = user.id;
        userType = 'admin';
      }

      const { error } = await supabase
        .from('chat_message_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          sub_user_id: subUserId,
          user_type: userType,
          emoji
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast({
        title: "Error",
        description: "Failed to add reaction",
        variant: "destructive"
      });
    }
  }, [effectiveUser, toast, isPublicBoard, publicBoardUser, subUsers, user]);

  // Create a new channel
  const createChannel = useCallback(async (name: string, emoji: string = '💬', isPrivate: boolean = false) => {
    if (!user || !name.trim()) return;

    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .insert({
          owner_id: user.id,
          name: name.trim(),
          emoji,
          is_private: isPrivate
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as participant
      if (data) {
        await supabase
          .from('chat_participants')
          .insert({
            channel_id: data.id,
            user_id: user.id,
            user_type: 'admin'
          });

        // Add all sub-users to the channel
        if (subUsers.length > 0) {
          const participantInserts = subUsers.map(subUser => ({
            channel_id: data.id,
            sub_user_id: subUser.id,
            user_type: 'sub_user'
          }));

          await supabase
            .from('chat_participants')
            .insert(participantInserts);
        }
      }

      loadChannels();
      toast({
        title: "Success",
        description: "Channel created successfully"
      });
    } catch (error) {
      console.error('Error creating channel:', error);
      toast({
        title: "Error",
        description: "Failed to create channel",
        variant: "destructive"
      });
    }
  }, [user, subUsers, loadChannels, toast]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!effectiveUser || !hasSubUsers) return;

    const channels = supabase
      .channel('chat-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages'
        },
        () => {
          loadMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_message_reactions'
        },
        () => {
          loadMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_channels'
        },
        () => {
          loadChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channels);
    };
  }, [effectiveUser, hasSubUsers, loadMessages, loadChannels]);

  // Initialize chat
  useEffect(() => {
    if (effectiveUser && boardOwnerId) {
      checkSubUsers();
    }
  }, [effectiveUser, boardOwnerId, checkSubUsers]);

  useEffect(() => {
    if (effectiveUser && hasSubUsers && boardOwnerId) {
      loadChannels();
    }
  }, [effectiveUser, hasSubUsers, boardOwnerId, loadChannels]);

  useEffect(() => {
    if (currentChannel) {
      loadMessages();
      loadParticipants();
    }
  }, [currentChannel, loadMessages, loadParticipants]);

  // Auto-setup default channel for new users
  useEffect(() => {
    const setupDefaultChannel = async () => {
      if (!effectiveUser || !hasSubUsers || channels.length > 0 || !boardOwnerId) return;

      try {
        // Create default General channel
        const { data: channelData, error: channelError } = await supabase
          .from('chat_channels')
          .insert({
            owner_id: boardOwnerId,
            name: 'General',
            emoji: '💬',
            is_default: true
          })
          .select()
          .single();

        if (channelError) throw channelError;

        // Add owner and all sub-users as participants
        const participantInserts = [
          // Add the board owner as admin
          {
            channel_id: channelData.id,
            user_id: boardOwnerId,
            user_type: 'admin'
          },
          // Add all sub-users
          ...subUsers.map(subUser => ({
            channel_id: channelData.id,
            sub_user_id: subUser.id,
            user_type: 'sub_user'
          }))
        ];

        await supabase
          .from('chat_participants')
          .insert(participantInserts);

        loadChannels();
      } catch (error) {
        console.error('Error setting up default channel:', error);
      }
    };

    setupDefaultChannel();
  }, [effectiveUser, hasSubUsers, channels.length, subUsers, loadChannels, boardOwnerId]);

  const currentUserInfo = useMemo(() => {
    if (!effectiveUser) return null;
    
    if (isPublicBoard && publicBoardUser) {
      return {
        id: publicBoardUser.id,
        type: 'sub_user' as const,
        name: publicBoardUser.fullName || publicBoardUser.email || 'User'
      };
    } else if (user) {
      return {
        id: user.id,
        type: 'admin' as const,
        name: user.user_metadata?.full_name || user.email || 'Admin'
      };
    }
    
    return null;
  }, [effectiveUser, isPublicBoard, publicBoardUser, user]);

  return {
    channels,
    currentChannel,
    setCurrentChannel,
    messages,
    participants,
    subUsers,
    loading,
    hasSubUsers,
    isInitialized,
    currentUserInfo,
    sendMessage,
    addReaction,
    createChannel,
    loadMessages,
    loadChannels
  };
};