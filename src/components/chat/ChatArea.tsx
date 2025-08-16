import { useState, useRef, useEffect } from 'react';
import { Hash, Users, Phone, Video, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageInput } from './MessageInput';
import { useChat } from './ChatProvider';
import { useChatMessages } from '@/hooks/useChatMessages';

export const ChatArea = () => {
  const chat = useChat();
  const { messages, currentChannel, sendMessage, loading } = useChatMessages();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Channel Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">{currentChannel?.emoji || '💬'}</span>
          <h2 className="font-semibold">{currentChannel?.name || 'general'}</h2>
          {currentChannel?.is_default && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-full text-xs">
              Default
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
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Hash className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Welcome to #{currentChannel?.name || 'general'}
                </h3>
                <p className="text-sm text-muted-foreground/70 text-center max-w-md">
                  This is the beginning of the #{currentChannel?.name || 'general'} channel. Start a conversation with your team!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="flex gap-3 group hover:bg-muted/30 -mx-4 px-4 py-2 rounded-lg transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary">
                        {message.sender_name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {message.sender_name || 'Unknown User'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </span>
                        {message.sender_type === 'admin' && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-foreground leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t border-border bg-background/50">
          <MessageInput 
            onSendMessage={sendMessage}
            placeholder={`Message #${currentChannel?.name || 'general'}`}
          />
        </div>
      </div>
    </div>
  );
};