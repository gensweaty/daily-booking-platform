import { useState, useEffect } from 'react';
import { Hash, Plus, Users, Settings, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useChat } from './ChatProvider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export const ChatSidebar = () => {
  const { user } = useAuth();
  const { me, currentChannelId, openChannel, startDM } = useChat();
  const [generalChannelId, setGeneralChannelId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string; type: 'admin' | 'sub_user'; avatarUrl?: string }>>([]);

  // Load general channel ID
  useEffect(() => {
    if (!user?.id) return;
    
    (async () => {
      const { data } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_default', true)
        .maybeSingle();
      
      if (data) setGeneralChannelId(data.id);
    })();
  }, [user?.id]);

  // Load team members (sub-users)
  useEffect(() => {
    if (!user?.id) return;
    
    (async () => {
      const teamMembers = [];
      
      // Add admin (current user or board owner)
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      if (adminProfile) {
        teamMembers.push({
          id: adminProfile.id,
          name: adminProfile.username || 'Admin',
          type: 'admin' as const,
          avatarUrl: adminProfile.avatar_url || ''
        });
      }
      
      // Add sub-users
      const { data: subUsers } = await supabase
        .from('sub_users')
        .select('id, fullname, avatar_url')
        .eq('board_owner_id', user.id);
      
      if (subUsers) {
        teamMembers.push(...subUsers.map(su => ({
          id: su.id,
          name: su.fullname || 'Member',
          type: 'sub_user' as const,
          avatarUrl: su.avatar_url || ''
        })));
      }
      
      setMembers(teamMembers);
    })();
  }, [user?.id]);

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
              <button 
                onClick={() => generalChannelId && openChannel(generalChannelId)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors duration-150",
                  currentChannelId === generalChannelId ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
              >
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
              {members.map(member => {
                const isMe = me && member.id === me.id && member.type === me.type;
                const initials = member.name
                  .split(' ')
                  .map(w => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
                
                return (
                  <div key={`${member.type}-${member.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm">
                    <div className="relative">
                      <Avatar className="h-6 w-6">
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                        <AvatarFallback className="text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-background rounded-full",
                        isMe ? "bg-green-500" : "bg-gray-400"
                      )} />
                    </div>
                    <span className="truncate text-muted-foreground">
                      {member.name} {isMe && '(you)'}
                    </span>
                    {!isMe && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 ml-auto opacity-0 group-hover:opacity-100"
                        onClick={() => startDM(member.id, member.type)}
                        title="Start direct message"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
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