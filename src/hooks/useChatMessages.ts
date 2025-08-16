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
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setChannels(data || []);
      
      // Set default channel as current
      const defaultChannel = data?.find(c => c.is_default);
      if (defaultChannel && !currentChannel) {
        setCurrentChannel(defaultChannel);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  }, [user?.id, currentChannel]);

  // Load messages for current channel
  const loadMessages = useCallback(async () => {
    if (!currentChannel?.id) {
      console.log('❌ No current channel, skipping message load');
      return;
    }

    try {
      setLoading(true);
      console.log('📥 Loading messages for channel:', currentChannel.id);
      
      // First try a simple query without joins to see if we can get basic data
      const { data: simpleData, error: simpleError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', currentChannel.id)
        .order('created_at', { ascending: true });

      if (simpleError) {
        console.error('❌ Error loading messages (simple query):', simpleError);
        throw simpleError;
      }

      console.log('📥 Raw messages loaded:', simpleData);

      // Now try with joins for user data
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender_user:sender_user_id(email),
          sender_sub_user:sender_sub_user_id(fullname, email)
        `)
        .eq('channel_id', currentChannel.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error loading messages with joins:', error);
        // Fall back to simple data if joins fail
        const enrichedMessages = simpleData?.map(msg => ({
          ...msg,
          sender_name: msg.sender_type === 'admin' ? 'Admin' : 'Sub User'
        })) || [];
        console.log('📥 Using fallback messages:', enrichedMessages);
        setMessages(enrichedMessages);
        return;
      }

      console.log('📥 Messages with joins loaded:', data);

      const enrichedMessages = data?.map(msg => ({
        ...msg,
        sender_name: msg.sender_type === 'admin' 
          ? (msg.sender_user?.email || 'Admin')
          : (msg.sender_sub_user?.fullname || msg.sender_sub_user?.email || 'Sub User')
      })) || [];

      console.log('✅ Final enriched messages:', enrichedMessages);
      setMessages(enrichedMessages);
    } catch (error) {
      console.error('❌ Critical error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [currentChannel?.id]);

  // Send message
  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    if (!currentChannel?.id || !user?.id || !content.trim()) {
      console.log('❌ Cannot send message:', { 
        hasChannel: !!currentChannel?.id, 
        hasUser: !!user?.id, 
        hasContent: !!content.trim() 
      });
      return;
    }

    try {
      console.log('📤 Sending message:', { 
        content: content.trim(), 
        channel_id: currentChannel.id, 
        sender_user_id: user.id 
      });

      const { error, data } = await supabase
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
        console.error('❌ Error sending message:', error);
        throw error;
      }
      
      console.log('✅ Message sent successfully:', data);
      // Immediately reload messages to show the new one
      loadMessages();
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
    }
  }, [currentChannel?.id, user?.id, loadMessages]);

  // Real-time subscriptions
  useEffect(() => {
    if (!currentChannel?.id) return;

    console.log('Setting up real-time subscription for channel:', currentChannel.id);

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
          console.log('Message change detected:', payload);
          loadMessages();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription for channel:', currentChannel.id);
      supabase.removeChannel(messagesSubscription);
    };
  }, [currentChannel?.id, loadMessages]);

  // Load initial data
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (currentChannel) {
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