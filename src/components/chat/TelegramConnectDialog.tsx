import { useEffect, useState } from 'react';
import { Loader2, Link2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type TelegramStatus = {
  connected: boolean;
  bot_username?: string | null;
  chat_linked?: boolean;
};

interface TelegramConnectDialogProps {
  compact?: boolean;
  className?: string;
}

export function TelegramConnectDialog({ compact = false, className }: TelegramConnectDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<TelegramStatus>({ connected: false });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const { data, error } = await supabase.functions.invoke('telegram-setup', {
        body: { action: 'status' },
      });

      if (error) throw error;

      setStatus({
        connected: !!data?.connected,
        bot_username: data?.bot_username ?? null,
        chat_linked: !!data?.chat_linked,
      });
    } catch (error) {
      console.error('Failed to fetch Telegram status:', error);
      setStatus({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleConnect = async () => {
    const botToken = token.trim();
    if (!botToken) {
      toast({
        title: 'Token is required',
        description: 'Please paste your Telegram bot token from BotFather.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      const { data, error } = await supabase.functions.invoke('telegram-setup', {
        body: {
          action: 'connect',
          bot_token: botToken,
          timezone,
        },
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || 'Failed to connect Telegram bot');
      }

      toast({
        title: 'Telegram connected',
        description: `Bot @${data?.bot_username || 'your_bot'} is now connected.`,
      });

      setToken('');
      setOpen(false);
      await fetchStatus();
    } catch (error) {
      console.error('Telegram connect error:', error);
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Could not connect Telegram bot.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = loadingStatus
    ? 'Checking Telegram...'
    : status.connected
      ? 'Telegram connected'
      : 'Telegram not connected';

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'default'}
        onClick={() => setOpen(true)}
        className={cn(
          'gap-2',
          compact ? 'h-7 text-[10px] px-2' : 'h-8 text-xs px-3',
          className
        )}
      >
        {loadingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        <span className={cn(status.connected ? 'text-secondary' : 'text-destructive')}>
          {statusLabel}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Telegram bot</DialogTitle>
            <DialogDescription>
              Connect Telegram manually so your AI works from Telegram without any AI-side setup steps.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">How to get your bot token:</p>
              <p>1. Open Telegram and search for @BotFather.</p>
              <p>2. Send /newbot and follow the steps.</p>
              <p>3. Copy the API token and paste it below.</p>
              <p>4. Open your new bot and send /start once.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram-bot-token">Bot token</Label>
              <Input
                id="telegram-bot-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:AA..."
                autoComplete="off"
              />
            </div>

            {status.connected && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                Connected bot: <span className="font-medium">@{status.bot_username || 'unknown'}</span>
                {status.chat_linked ? (
                  <p className="mt-1 text-secondary">Chat linked and ready.</p>
                ) : (
                  <p className="mt-1 text-muted-foreground">Send /start to your bot once to link your chat.</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" onClick={handleConnect} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {status.connected ? 'Reconnect bot' : 'Connect bot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}