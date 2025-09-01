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
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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

  // Load messages for current channel (paginated)
  const loadMessages = useCallback(async (loadOlder = false) => {
    if (!currentChannel?.id) {
      console.log('🚫 No current channel, skipping message load');
      return;
    }

    try {
      if (loadOlder) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setMessages([]);
        setHasMore(true);
      }
      
      const limit = 20;
      const offset = loadOlder ? messages.length : 0;

      console.log(`📥 Loading ${loadOlder ? 'older' : 'recent'} messages for channel:`, currentChannel.id);
      
      // Simplified query without joins for better performance
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', currentChannel.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ Error loading messages:', error);
        throw error;
      }

      console.log(`✅ Loaded ${data?.length || 0} ${loadOlder ? 'older' : 'recent'} messages`);

      // Add sender names based on type (simplified without joins)
      const enrichedMessages = (data || []).map(msg => ({
        ...msg,
        sender_name: msg.sender_type === 'admin' ? 'Admin' : 'Sub User'
      }));

      if (loadOlder) {
        // Prepend older messages (reverse order since we got them desc)
        setMessages(prev => [...enrichedMessages.reverse(), ...prev]);
      } else {
        // Set initial messages (reverse since we got them desc)
        setMessages(enrichedMessages.reverse());
      }

      // Check if there are more messages
      if (data && data.length < limit) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      if (!loadOlder) {
        setMessages([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentChannel?.id]);

  // Load more messages (for pagination) 
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    await loadMessages(true);
  }, [hasMore, loadingMore, loadMessages]);

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
    loadMessages,
    loadMoreMessages,
    hasMore,
    loadingMore
  };
};