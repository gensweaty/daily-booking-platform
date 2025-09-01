import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send, ChevronUp } from 'lucide-react';
import { useChat } from './ChatProvider';
import { MessageList } from './MessageList';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useToast } from '@/hooks/use-toast';

interface ChatAreaProps {
  onMessageInputFocus?: () => void;
}

export const ChatArea = ({ onMessageInputFocus }: ChatAreaProps = {}) => {
  const { me, currentChannelId, isInitialized } = useChat();
  const { toast } = useToast();
  
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    channels,
    currentChannel,
    setCurrentChannel,
    sendMessage,
    loading,
    loadMoreMessages,
    hasMore,
    loadingMore
  } = useChatMessages();

  // Set current channel when currentChannelId changes
  useEffect(() => {
    if (currentChannelId && channels.length > 0) {
      const channel = channels.find(c => c.id === currentChannelId);
      if (channel && channel !== currentChannel) {
        setCurrentChannel(channel);
      }
    }
  }, [currentChannelId, channels, currentChannel, setCurrentChannel]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!loading && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loading]);

  // Handle scroll to load more messages
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const isAtTop = target.scrollTop < 100; // Near top
    
    if (isAtTop && hasMore && !loadingMore && !loading) {
      loadMoreMessages();
    }
  };

  const handleSend = async () => {
    if (!draft.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(draft.trim());
      setDraft('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReply = (messageId: string) => {
    // Simple reply implementation - you can enhance this
    console.log('Reply to:', messageId);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    // Simple reaction implementation - you can enhance this  
    console.log('React to:', messageId, 'with:', emoji);
  };

  // Show loading state
  if (loading && messages.length === 0) {
    return (
      <div className="grid grid-rows-[auto,1fr,auto] h-full overflow-hidden bg-background">
        <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
          <MessageCircle className="h-5 w-5 animate-pulse" />
          <h2 className="font-semibold">Loading...</h2>
        </div>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading recent messages...</p>
          </div>
        </div>
        <div className="p-4 border-t bg-muted/30">
          <div className="bg-muted rounded-md h-10 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-rows-[auto,1fr,auto] h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
        <MessageCircle className="h-5 w-5" />
        <h2 className="font-semibold">{currentChannel?.name || 'Chat'}</h2>
        {currentChannel?.emoji && (
          <span className="text-sm">{currentChannel.emoji}</span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea 
        className="flex-1 px-4"
        ref={scrollAreaRef}
        onScrollCapture={handleScroll}
      >
        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMoreMessages}
              disabled={loadingMore}
              className="flex items-center gap-2"
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Loading...
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Load older messages
                </>
              )}
            </Button>
          </div>
        )}

        <MessageList
          messages={messages}
          currentUser={me ? {
            id: me.id,
            type: me.type,
            name: me.email || me.name || 'You'
          } : null}
          onReply={handleReply}
          onReaction={handleReaction}
        />
        
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onMessageInputFocus}
            className="min-h-[2.5rem] max-h-32 resize-none"
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            size="sm"
            className="px-3"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};