import { useState } from 'react';
import { Hash, Plus, Users, Settings, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CreateChannelDialog } from './CreateChannelDialog';
import { useChat } from '@/hooks/useChat';

export const ChatSidebar = () => {
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const chat = useChat();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="w-64 bg-muted/30 border-r border-border flex flex-col">
      {/* Workspace Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Team Workspace</h2>
            <p className="text-xs text-muted-foreground">
              {chat.participants.length} members
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
                onClick={() => setShowCreateChannel(true)}
                className="h-5 w-5 p-0 hover:bg-muted"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Channel List */}
            <div className="space-y-1">
              {chat.channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => chat.setCurrentChannel(channel)}
                  className={`
                    w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left
                    transition-colors duration-150
                    ${chat.currentChannel?.id === channel.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }
                  `}
                >
                  <span className="text-base">{channel.emoji}</span>
                  <span className="truncate">{channel.name}</span>
                  {channel.is_default && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      Default
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {/* Direct Messages Header */}
            <div className="flex items-center justify-between mt-6 mb-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Team Members
              </h3>
            </div>

            {/* Team Members List */}
            <div className="space-y-1">
              {/* Admin (Current User) */}
              {chat.currentUserInfo && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm">
                  <div className="relative">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-xs">
                        {getInitials(chat.currentUserInfo.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                  </div>
                  <span className="truncate text-muted-foreground">
                    {chat.currentUserInfo.name} (you)
                  </span>
                </div>
              )}

              {/* Sub Users */}
              {chat.subUsers.map((subUser) => (
                <div
                  key={subUser.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted"
                >
                  <div className="relative">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={subUser.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getInitials(subUser.fullname)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-400 border-2 border-background rounded-full" />
                  </div>
                  <span className="truncate text-muted-foreground">
                    {subUser.fullname}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* User Info Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" />
            <AvatarFallback className="text-xs">
              {chat.currentUserInfo ? getInitials(chat.currentUserInfo.name) : 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {chat.currentUserInfo?.name || 'Admin'}
            </p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Create Channel Dialog */}
      <CreateChannelDialog
        open={showCreateChannel}
        onOpenChange={setShowCreateChannel}
        onCreateChannel={chat.createChannel}
      />
    </div>
  );
};