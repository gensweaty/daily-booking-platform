import { useState, useRef, useEffect } from 'react';
import { Hash, Users, Phone, Video, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChat } from '@/hooks/useChat';

export const ChatArea = () => {
  const chat = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  if (!chat.currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Hash className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Welcome to Team Chat</h3>
          <p className="text-sm">Select a channel to start messaging</p>
        </div>
      </div>
    );
  }

  const handleSendMessage = (content: string) => {
    chat.sendMessage(content, replyingTo || undefined);
    setReplyingTo(null);
  };

  const replyingToMessage = replyingTo 
    ? chat.messages.find(m => m.id === replyingTo)
    : null;

  return (
    <div className="flex-1 flex flex-col">
      {/* Channel Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">{chat.currentChannel.emoji}</span>
          <h2 className="font-semibold">{chat.currentChannel.name}</h2>
          {chat.currentChannel.is_private && (
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 rounded-full text-xs">
              🔒 Private
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1">
          <div className="p-4">
            {chat.loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <MessageList
                  messages={chat.messages}
                  currentUser={chat.currentUserInfo}
                  onReply={setReplyingTo}
                  onReaction={chat.addReaction}
                />
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t border-border bg-background/50">
          <MessageInput
            onSendMessage={handleSendMessage}
            placeholder={`Message #${chat.currentChannel.name}`}
            replyingTo={replyingToMessage}
            onCancelReply={() => setReplyingTo(null)}
          />
        </div>
      </div>
    </div>
  );
};