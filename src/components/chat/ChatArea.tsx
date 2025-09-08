import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Wifi, WifiOff } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { resolveAvatarUrl } from './_avatar';
import { useToast } from '@/hooks/use-toast';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { MessageListSkeleton } from '@/components/ui/message-skeleton';
import { getEffectivePublicEmail } from '@/utils/chatEmail';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOptimizedChatMessages } from '@/hooks/useOptimizedChatMessages';
import { chatPerformanceManager } from '@/utils/chatPerformanceManager';

type Message = {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  sender_user_id?: string;
  sender_sub_user_id?: string;
  sender_type: 'admin' | 'sub_user';
  sender_name?: string;
  sender_avatar_url?: string;
  channel_id: string;
  has_attachments?: boolean;
  message_type?: string;
  is_deleted?: boolean;
  edited_at?: string;
  original_content?: string;
  _isUpdate?: boolean;
  attachments?: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
    public_url?: string;
    object_url?: string;
  }>;
};

interface ChatAreaProps {
  onMessageInputFocus?: () => void;
}

export const ChatArea = ({ onMessageInputFocus }: ChatAreaProps = {}) => {
  const { me, currentChannelId, boardOwnerId, isInitialized, realtimeEnabled } = useChat();
  const { toast } = useToast();
  const { t } = useLanguage();
  const location = useLocation();

  const effectiveEmail = getEffectivePublicEmail(location.pathname, me?.email);
  const isPublic = location.pathname.startsWith('/board/');

  // Use optimized chat messages hook
  const {
    messages,
    loading,
    loadingMore,
    hasMoreMessages,
    error,
    loadMessages,
    loadMoreMessages,
    performanceStats
  } = useOptimizedChatMessages({
    channelId: currentChannelId,
    userId: me?.id,
    isPublic,
    realtimeEnabled
  });

  const [channelInfo, setChannelInfo] = useState<{ 
    name: string; 
    isDM: boolean; 
    dmPartner?: { name: string; avatar?: string } 
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState<string | null>(null);
  const [showPerformanceStats, setShowPerformanceStats] = useState(false);

  const headerCacheRef = useRef<Map<string, { name: string; isDM: boolean; dmPartner?: { name: string; avatar?: string } }>>(new Map());
  const [generalId, setGeneralId] = useState<string | null>(null);
  const [generalIdLoading, setGeneralIdLoading] = useState(true);

  // Resolve current user ID
  useEffect(() => {
    if (me?.id) {
      setResolvedCurrentUserId(me.id);
    } else if (effectiveEmail) {
      setResolvedCurrentUserId(effectiveEmail);
    }
  }, [me?.id, effectiveEmail]);

  // Load channel header info (optimized with caching)
  useEffect(() => {
    if (!currentChannelId || !boardOwnerId) {
      setChannelInfo(null);
      return;
    }

    const loadChannelHeader = async () => {
      // Check cache first
      const cached = headerCacheRef.current.get(currentChannelId);
      if (cached) {
        setChannelInfo(cached);
        return;
      }

      try {
        const { data: channelData, error } = await supabase
          .from('chat_channels')
          .select('name, is_private')
          .eq('id', currentChannelId)
          .single();

        if (error || !channelData) {
          console.error('Failed to load channel header:', error);
          return;
        }

        const isDM = channelData.is_private && channelData.name.includes(':DM:');
        let dmPartner = undefined;

        if (isDM) {
          // Extract partner info for DM
          const parts = channelData.name.split(':DM:');
          if (parts.length === 3) {
            const partnerEmail = parts[1] === me?.email ? parts[2] : parts[1];
            dmPartner = {
              name: partnerEmail,
              avatar: await resolveAvatarUrl(partnerEmail, boardOwnerId)
            };
          }
        }

        const info = {
          name: isDM ? 'Direct Message' : channelData.name,
          isDM,
          dmPartner
        };

        setChannelInfo(info);
        headerCacheRef.current.set(currentChannelId, info);
      } catch (error) {
        console.error('Error loading channel header:', error);
      }
    };

    loadChannelHeader();
  }, [currentChannelId, boardOwnerId, me?.email]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current && messages.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handlers
  const handleReply = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setReplyingTo(message);
    }
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleSendMessage = async (content: string, attachments: any[] = []) => {
    if (!currentChannelId || !me) return;

    try {
      const messageData = {
        content: content.trim(),
        channel_id: currentChannelId,
        sender_user_id: me.type === 'admin' ? me.id : null,
        sender_sub_user_id: me.type === 'sub_user' ? me.id : null,
        sender_type: me.type,
        has_attachments: attachments.length > 0,
        message_type: attachments.length > 0 ? 'file' : 'text',
        reply_to_id: replyingTo?.id || null
      };

      const { data: message, error } = await supabase
        .from('chat_messages')
        .insert(messageData)
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: "Failed to send message",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      // Insert attachments if any
      if (attachments.length > 0 && message) {
        const fileRecords = attachments.map(file => ({
          message_id: message.id,
          filename: file.filename,
          file_path: file.file_path,
          content_type: file.content_type,
          size: file.size
        }));

        const { error: fileError } = await supabase
          .from('chat_message_files')
          .insert(fileRecords);

        if (fileError) {
          console.error('Error saving attachments:', fileError);
        }
      }

      // Clear reply state
      setReplyingTo(null);
      
      // Refresh messages
      loadMessages();
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send message",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      const { error } = await supabase.functions.invoke('edit-message', {
        body: { messageId, content }
      });

      if (error) {
        console.error('Error editing message:', error);
        toast({
          title: "Failed to edit message",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      setEditingMessage(null);
      loadMessages();
      
    } catch (error) {
      console.error('Error editing message:', error);
      toast({
        title: "Failed to edit message",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-message', {
        body: { messageId }
      });

      if (error) {
        console.error('Error deleting message:', error);
        toast({
          title: "Failed to delete message",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      loadMessages();
      
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Failed to delete message",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Initializing chat...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 p-0">
          <MessageListSkeleton />
        </div>
        <div className="border-t bg-background/80 backdrop-blur">
          <MessageInput
            onSendMessage={() => {}}
            placeholder={t('chat.typeMessage')}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <WifiOff className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive mb-2">Failed to load messages</p>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <button
              onClick={() => loadMessages()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-background">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <h3 className="font-medium">{channelInfo?.name || 'Chat'}</h3>
          {channelInfo?.isDM && channelInfo.dmPartner && (
            <p className="text-xs text-muted-foreground">
              {t('chat.dmWith')} {channelInfo.dmPartner.name}
            </p>
          )}
        </div>
        
        {/* Performance indicator */}
        <div className="flex items-center gap-2">
          {performanceStats.networkQuality?.type === 'slow' && (
            <div className="flex items-center gap-1 text-xs text-orange-500">
              <WifiOff className="h-3 w-3" />
              <span>Slow</span>
            </div>
          )}
          {performanceStats.networkQuality?.type === 'fast' && !isPublic && (
            <div className="flex items-center gap-1 text-xs text-green-500">
              <Wifi className="h-3 w-3" />
              <span>Fast</span>
            </div>
          )}
          {showPerformanceStats && (
            <div className="text-xs text-muted-foreground">
              {performanceStats.pollingInterval}ms
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Load more trigger */}
          {hasMoreMessages && (
            <div className="text-center py-4">
              <button
                onClick={loadMoreMessages}
                disabled={loadingMore}
                className="px-4 py-2 text-sm bg-muted/50 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          )}
          
          <MessageList
            messages={messages}
            currentUser={{
              id: resolvedCurrentUserId || '',
              type: me?.type || 'admin',
              name: me?.name || me?.email || 'User'
            }}
            onReply={handleReply}
            onEdit={handleEdit}
            onDelete={handleDeleteMessage}
          />
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-background/80 backdrop-blur">
        <MessageInput
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          placeholder={t('chat.typeMessage')}
          replyingTo={replyingTo}
          onCancelReply={handleCancelReply}
          editingMessage={editingMessage}
          onCancelEdit={handleCancelEdit}
          onMessageInputFocus={onMessageInputFocus}
        />
      </div>
    </div>
  );
};