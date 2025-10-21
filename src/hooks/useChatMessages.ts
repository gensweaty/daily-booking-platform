import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatMessage {
  id: string;
  content: string;
  channel_id: string;
  sender_user_id?: string;
  sender_sub_user_id?: string;
  sender_type: 'admin' | 'sub_user';
  created_at: string;
  updated_at: string;
  reply_to_id?: string;
  sender_name?: string;
  has_attachments?: boolean;
  message_type?: string;
  attachments?: ChatAttachment[];
  is_deleted?: boolean;
  edited_at?: string;
  original_content?: string;
}

export interface ChatAttachment {
  id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  meta?: {
    duration?: number;
    [key: string]: any;
  };
}

export interface ChatChannel {
  id: string;
  name: string;
  emoji: string;
  owner_id: string;
  is_default: boolean;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export const useChatMessages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<ChatChannel | null>(null);
  const [loading, setLoading] = useState(true);

  // Load channels
  const loadChannels = useCallback(async () => {
    if (!user?.id) {
      console.log('🚫 No user, cannot load channels');
      return;
    }

    try {
      console.log('📂 Loading channels for user:', user.id);
      const { data, error } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error loading channels:', error);
        throw error;
      }

      console.log('✅ Loaded channels:', data);
      setChannels(data || []);
      
      // Set default channel as current
      const defaultChannel = data?.find(c => c.is_default);
      if (defaultChannel && !currentChannel) {
        console.log('🎯 Setting default channel:', defaultChannel);
        setCurrentChannel(defaultChannel);
      }
    } catch (error) {
      console.error('❌ Error loading channels:', error);
    }
  }, [user?.id, currentChannel]);

  // Load messages for current channel
  const loadMessages = useCallback(async () => {
    if (!currentChannel?.id) {
      console.log('🚫 No current channel, skipping message load');
      return;
    }

    try {
      setLoading(true);
      console.log('📥 Loading messages for channel:', currentChannel.id);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender_user:sender_user_id(email, username),
          sender_sub_user:sender_sub_user_id(fullname, email)
        `)
        .eq('channel_id', currentChannel.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error loading messages:', error);
        throw error;
      }

      console.log('✅ Loaded raw messages:', data);

      // Get message attachments
      const messageIds = data?.map(msg => msg.id) || [];
      let attachmentsData = [];
      
      if (messageIds.length > 0) {
        const { data: attachments, error: attachError } = await supabase
          .from('chat_message_files')
          .select('*')
          .in('message_id', messageIds);
          
        if (attachError) {
          console.error('❌ Error loading attachments:', attachError);
        } else {
          attachmentsData = attachments || [];
        }
      }

      const enrichedMessages = data?.map(msg => {
        const messageAttachments = attachmentsData.filter(att => att.message_id === msg.id);
        return {
          ...msg,
          sender_name: msg.sender_type === 'admin' 
            ? (msg.sender_user?.username || msg.sender_user?.email || 'Admin')
            : (msg.sender_sub_user?.fullname || msg.sender_sub_user?.email || 'Sub User'),
          attachments: messageAttachments
        };
      }) || [];

      console.log('✅ Enriched messages with attachments:', enrichedMessages);
      setMessages(enrichedMessages);
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [currentChannel?.id]);

  // Send message
  const sendMessage = useCallback(async (content: string, attachments: any[] = [], replyToId?: string) => {
    if (!currentChannel?.id || !user?.id || (!content.trim() && attachments.length === 0)) {
      console.log('❌ Cannot send message:', { 
        channelId: currentChannel?.id, 
        userId: user?.id, 
        content: content?.trim(),
        attachments: attachments.length
      });
      return;
    }

    console.log('📤 Sending message:', { 
      content: content.trim(), 
      channelId: currentChannel.id,
      userId: user.id,
      attachments: attachments.length
    });

    try {
      // Insert message
      const { data: messageData, error } = await supabase
        .from('chat_messages')
        .insert({
          content: content.trim(),
          channel_id: currentChannel.id,
          sender_user_id: user.id,
          sender_type: 'admin',
          reply_to_id: replyToId || null,
          has_attachments: attachments.length > 0,
          message_type: attachments.length > 0 ? 'file' : 'text'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database error sending message:', error);
        throw error;
      }
      
      console.log('✅ Message sent successfully:', messageData);
      
      // Insert file attachments if any
      if (attachments.length > 0 && messageData) {
        const fileRecords = attachments.map(file => ({
          message_id: messageData.id,
          filename: file.filename,
          file_path: file.file_path,
          content_type: file.content_type,
          size: file.size
        }));
        
        const { error: fileError } = await supabase
          .from('chat_message_files')
          .insert(fileRecords);
          
        if (fileError) {
          console.error('❌ Error saving file attachments:', fileError);
        } else {
          console.log('✅ File attachments saved:', fileRecords.length);
        }
      }
      
      // Force reload messages to ensure UI updates
      await loadMessages();
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  }, [currentChannel?.id, user?.id, loadMessages]);

  // Real-time subscriptions
  useEffect(() => {
    if (!currentChannel?.id) return;

    console.log('🔄 Setting up real-time subscription for channel:', currentChannel.id);

    const messagesSubscription = supabase
      .channel(`messages:${currentChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${currentChannel.id}`
        },
        (payload) => {
          console.log('🔔 Message change detected:', payload);
          loadMessages();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🧹 Cleaning up subscription for channel:', currentChannel.id);
      supabase.removeChannel(messagesSubscription);
    };
  }, [currentChannel?.id, loadMessages]);

  // Load initial data
  useEffect(() => {
    if (user?.id) {
      console.log('🔄 User changed, loading channels:', user.id);
      loadChannels();
    }
  }, [user?.id, loadChannels]);

  useEffect(() => {
    if (currentChannel) {
      console.log('🔄 Channel changed, loading messages:', currentChannel.name);
      loadMessages();
    }
  }, [currentChannel, loadMessages]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, content: string) => {
    try {
      console.log('📝 Editing message:', { messageId, content });
      
      const { error } = await supabase.functions.invoke('edit-message', {
        body: { messageId, content }
      });

      if (error) {
        console.error('❌ Error editing message:', error);
        throw error;
      }
      
      console.log('✅ Message edited successfully');
      // Reload messages to reflect changes
      await loadMessages();
    } catch (error) {
      console.error('❌ Edit message failed:', error);
      throw error;
    }
  }, [loadMessages]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      console.log('🗑️ Deleting message:', messageId);
      
      const { error } = await supabase.functions.invoke('delete-message', {
        body: { messageId }
      });

      if (error) {
        console.error('❌ Error deleting message:', error);
        throw error;
      }
      
      console.log('✅ Message deleted successfully');
      // Reload messages to reflect changes
      await loadMessages();
    } catch (error) {
      console.error('❌ Delete message failed:', error);
      throw error;
    }
  }, [loadMessages]);

  return {
    messages,
    channels,
    currentChannel,
    setCurrentChannel,
    sendMessage,
    editMessage,
    deleteMessage,
    loading,
    loadChannels,
    loadMessages
  };
};