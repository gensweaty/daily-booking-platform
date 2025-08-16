import { useState } from 'react';
import { Hash, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChannel: (name: string, emoji: string, isPrivate: boolean) => void;
}

const EMOJI_OPTIONS = ['💬', '📢', '💼', '🎯', '🚀', '📊', '🎨', '🔧', '📝', '🎉', '💡', '🌟'];

export const CreateChannelDialog = ({ open, onOpenChange, onCreateChannel }: CreateChannelDialogProps) => {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💬');
  const [isPrivate, setIsPrivate] = useState(false);
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (name.trim()) {
      onCreateChannel(name.trim(), emoji, isPrivate);
      
      // Reset form
      setName('');
      setEmoji('💬');
      setIsPrivate(false);
      setDescription('');
      onOpenChange(false);
    }
  };

  const formatChannelName = (input: string) => {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 21);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatChannelName(e.target.value);
    setName(formatted);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel Type */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              {isPrivate ? (
                <Lock className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Hash className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {isPrivate ? 'Private channel' : 'Public channel'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPrivate 
                    ? 'Only invited members can see this channel'
                    : 'Anyone in the workspace can join this channel'
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
            />
          </div>

          {/* Emoji Selection */}
          <div className="space-y-2">
            <Label>Channel emoji</Label>
            <div className="flex gap-2 flex-wrap p-2 bg-muted/30 rounded-lg">
              {EMOJI_OPTIONS.map((emojiOption) => (
                <button
                  key={emojiOption}
                  type="button"
                  onClick={() => setEmoji(emojiOption)}
                  className={`
                    w-8 h-8 rounded text-lg hover:bg-muted transition-colors
                    ${emoji === emojiOption ? 'bg-primary text-primary-foreground' : ''}
                  `}
                >
                  {emojiOption}
                </button>
              ))}
            </div>
          </div>

          {/* Channel Name */}
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel name</Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                <span className="text-base">{emoji}</span>
                <span className="text-sm">#</span>
              </div>
              <Input
                id="channel-name"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. marketing-planning"
                className="pl-16"
                maxLength={21}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Names must be lowercase, without spaces or periods, and shorter than 22 characters.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="channel-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="min-h-[80px]"
              maxLength={250}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
            >
              Create Channel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};