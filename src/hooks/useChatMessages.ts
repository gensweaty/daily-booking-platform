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

      const enrichedMessages = data?.map(msg => ({
        ...msg,
        sender_name: msg.sender_type === 'admin' 
          ? (msg.sender_user?.username || msg.sender_user?.email || 'Admin')
          : (msg.sender_sub_user?.fullname || msg.sender_sub_user?.email || 'Sub User')
      })) || [];

      console.log('✅ Enriched messages:', enrichedMessages);
      setMessages(enrichedMessages);
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [currentChannel?.id]);

  // Send message
  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    if (!currentChannel?.id || !user?.id || !content.trim()) {
      console.log('❌ Cannot send message:', { 
        channelId: currentChannel?.id, 
        userId: user?.id, 
        content: content?.trim() 
      });
      return;
    }

    console.log('📤 Sending message:', { 
      content: content.trim(), 
      channelId: currentChannel.id,
      userId: user.id 
    });

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          content: content.trim(),
          channel_id: currentChannel.id,
          sender_user_id: user.id,
          sender_type: 'admin',
          reply_to_id: replyToId || null
        })
        .select();

      if (error) {
        console.error('❌ Database error sending message:', error);
        throw error;
      }
      
      console.log('✅ Message sent successfully:', data);
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

  return {
    messages,
    channels,
    currentChannel,
    setCurrentChannel,
    sendMessage,
    loading,
    loadChannels,
    loadMessages
  };
};