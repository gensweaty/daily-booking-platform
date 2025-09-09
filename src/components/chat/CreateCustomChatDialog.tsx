import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TeamMember {
  id: string;
  name: string;
  type: 'admin' | 'sub_user';
  avatar_url?: string | null;
}

interface CreateCustomChatDialogProps {
  teamMembers: TeamMember[];
  onChatCreated: () => void;
}

export const CreateCustomChatDialog = ({ teamMembers, onChatCreated }: CreateCustomChatDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { me, boardOwnerId, openChannel } = useChat();
  const [open, setOpen] = useState(false);
  const [chatName, setChatName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const availableParticipants = teamMembers.filter(member => {
    // Exclude current user from participant selection
    if (!me) return true;
    return !(member.id === me.id && member.type === me.type);
  });

  const handleParticipantToggle = (memberId: string, memberType: 'admin' | 'sub_user') => {
    const participantKey = `${memberType}:${memberId}`;
    setSelectedParticipants(prev =>
      prev.includes(participantKey)
        ? prev.filter(id => id !== participantKey)
        : [...prev, participantKey]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatName.trim()) {
      toast({
        title: 'Error',
        description: 'Chat name is required',
        variant: 'destructive',
      });
      return;
    }

    if (selectedParticipants.length < 2) {
      toast({
        title: 'Error', 
        description: 'Pick at least two participants',
        variant: 'destructive',
      });
      return;
    }

    if (!me || !boardOwnerId) {
      toast({
        title: 'Error',
        description: 'Unable to create chat. Please refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      // Resolve creator ID for sub-users if needed
      let creatorId = me.id;
      if (me.type === 'sub_user' && typeof me.id === 'string' && me.id.includes('@')) {
        const { data: subUser } = await supabase
          .from('sub_users')
          .select('id')
          .eq('board_owner_id', boardOwnerId)
          .eq('email', me.email || me.id)
          .maybeSingle();
        
        if (subUser?.id) {
          creatorId = subUser.id;
        }
      }

      // Transform participants to expected format
      const participants = selectedParticipants.map(participantKey => {
        const [type, id] = participantKey.split(':');
        return { type, id };
      });

      console.log('🔧 Creating custom chat with params:', {
        p_owner_id: boardOwnerId,
        p_creator_type: me.type,
        p_creator_id: creatorId,
        p_name: chatName.trim(),
        p_participants: participants
      });

      console.log('🔧 Selected participants for custom chat:', selectedParticipants);
      console.log('🔧 Transformed participants:', participants);

      const { data: channelId, error } = await supabase.rpc('create_custom_chat', {
        p_owner_id: boardOwnerId,
        p_creator_type: me.type,
        p_creator_id: creatorId,
        p_name: chatName.trim(),
        p_participants: participants
      });

      if (error) {
        console.error('❌ Error creating custom chat:', error);
        console.error('❌ Error details:', error.message, error.code, error.details);
        toast({
          title: 'Cannot create',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ Custom chat created successfully:', channelId);
      
      // Reset form and close dialog
      setChatName('');
      setSelectedParticipants([]);
      setOpen(false);
      
      // Refresh the custom chats list
      console.log('🔄 Refreshing custom chats after creation...');
      await onChatCreated();
      
      // Open the new channel
      if (channelId) {
        console.log('🔄 Opening new channel:', channelId);
        openChannel(channelId as string);
      }

      toast({
        title: 'Success',
        description: `Chat "${chatName.trim()}" created successfully`,
      });

    } catch (error) {
      console.error('❌ Unexpected error creating custom chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to create chat. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setChatName('');
    setSelectedParticipants([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
          <Plus className="h-4 w-4" />
          <span className="sr-only">Create custom chat</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md z-[9999] bg-background border shadow-lg">
        <DialogHeader>
          <DialogTitle>
            <LanguageText>{t('chat.createCustomChat')}</LanguageText>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chatName">
              <LanguageText>{t('chat.chatName')}</LanguageText>
            </Label>
            <Input
              id="chatName"
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              placeholder="Enter chat name..."
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>
              <LanguageText>{t('chat.selectParticipants')}</LanguageText>
              <span className="text-xs text-muted-foreground ml-1">
                (minimum 2)
              </span>
            </Label>
            
            <ScrollArea className="h-48 border rounded-md p-3">
              <div className="space-y-3">
                {availableParticipants.map((member) => {
                  const participantKey = `${member.type}:${member.id}`;
                  const isSelected = selectedParticipants.includes(participantKey);
                  
                  return (
                    <div key={participantKey} className="flex items-center space-x-2">
                      <Checkbox
                        id={participantKey}
                        checked={isSelected}
                        onCheckedChange={() => handleParticipantToggle(member.id, member.type)}
                        disabled={isCreating}
                      />
                      <Label
                        htmlFor={participantKey}
                        className="flex-1 cursor-pointer flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{member.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({member.type === 'admin' ? 'Admin' : 'Member'})
                        </span>
                      </Label>
                    </div>
                  );
                })}
                
                {availableParticipants.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    No other team members available
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !chatName.trim() || selectedParticipants.length < 2}
            >
              {isCreating ? 'Creating...' : 'Create Chat'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};