import { useState } from 'react';
import { Hash, Plus, Users, Settings, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useChat } from './ChatProvider';

export const ChatSidebar = () => {
  const { me } = useChat();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = (me?.name || 'U')
    .split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="min-w-[220px] max-w-[260px] bg-muted/30 border-r border-border flex flex-col">
      {/* Workspace Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Team Workspace</h2>
            <p className="text-xs text-muted-foreground">
              Chat with your team
            </p>
          </div>
        </div>
      </div>

      {/* Channels Section */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3">
            {/* Channels Header */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Channels
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-muted"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Channel List */}
            <div className="space-y-1">
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors duration-150 bg-primary/10 text-primary">
                <span className="text-base">💬</span>
                <span className="truncate">general</span>
                <Badge variant="secondary" className="text-xs ml-auto">
                  Default
                </Badge>
              </button>
            </div>

            {/* Direct Messages Header */}
            <div className="flex items-center justify-between mt-6 mb-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Team Members
              </h3>
            </div>

            {/* Team Members List */}
            <div className="space-y-1">
              {/* Current User */}
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm">
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      AD
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                </div>
                <span className="truncate text-muted-foreground">
                  Admin (you)
                </span>
              </div>

              {/* Placeholder for Sub Users */}
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted">
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      SU
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-400 border-2 border-background rounded-full" />
                </div>
                <span className="truncate text-muted-foreground">
                  Sub Users
                </span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* User Info Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {me?.avatarUrl ? <AvatarImage src={me.avatarUrl} /> : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {me?.name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground">{me?.type === 'admin' ? 'Admin' : 'Member'}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};