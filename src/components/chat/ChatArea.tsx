import { useState, useRef, useEffect } from 'react';
import { Hash, Users, Phone, Video, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from './ChatProvider';

export const ChatArea = () => {
  const chat = useChat();

  return (
    <div className="flex-1 flex flex-col">
      {/* Channel Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h2 className="font-semibold">general</h2>
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-full text-xs">
            Default
          </div>
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
            <div className="flex flex-col items-center justify-center py-12">
              <Hash className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">Welcome to #general</h3>
              <p className="text-sm text-muted-foreground/70 text-center max-w-md">
                This is the beginning of the #general channel. Start a conversation with your team!
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Message Input Placeholder */}
        <div className="border-t border-border bg-background/50 p-4">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
            <input 
              type="text" 
              placeholder="Message #general" 
              className="flex-1 bg-transparent border-none outline-none text-sm"
              disabled
            />
            <Button size="sm" disabled>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};