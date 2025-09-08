import { useState } from 'react';
import { Reply, Edit, Trash2, Smile } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';

type ChatMessage = {
  id: string;
  channel_id: string;
  sender_user_id?: string;
  sender_sub_user_id?: string;
  sender_type: 'admin' | 'sub_user';
  content: string;
  reply_to_id?: string;
  created_at: string;
  updated_at: string;
  sender_name?: string;
  sender_avatar?: string;
  reactions?: any[];
  reply_to?: ChatMessage;
  files?: any[];
  is_deleted?: boolean;
  edited_at?: string;
  original_content?: string;
  message_type?: string;
};

interface MessageListProps {
  messages: ChatMessage[];
  currentUser: { id: string; type: 'admin' | 'sub_user'; name: string } | null;
  onReply: (messageId: string) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
}

export const MessageList = ({
  messages,
  currentUser,
  onReply,
  onEdit,
  onDelete,
}: MessageListProps) => {
  const { t } = useLanguage();
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isOwnMessage = (message: ChatMessage) => {
    if (!currentUser) return false;
    if (currentUser.type === 'admin' && message.sender_type === 'admin') {
      return message.sender_user_id === currentUser.id;
    }
    if (currentUser.type === 'sub_user' && message.sender_type === 'sub_user') {
      // tolerate email-based temp identifiers
      return (
        message.sender_sub_user_id === currentUser.id ||
        (message.sender_name === currentUser.name && currentUser.id?.includes('@'))
      );
    }
    return false;
  };

  // ---------- NEW: robust deleted check ----------
  const isDeleted = (m: ChatMessage) => {
    if (m.is_deleted) return true;
    if (m.message_type === 'deleted') return true;
    const c = (m.content || '').trim().toLowerCase();
    // also catch content that was replaced by renderer/back-end
    return c === 'message deleted' || c === '[message deleted]';
  };

  // ---------- NEW: edited flag ----------
  const wasEdited = (m: ChatMessage) => {
    if (isDeleted(m)) return false;
    if (m.edited_at) return true;
    if (!m.updated_at || !m.created_at) return false;
    return new Date(m.updated_at).getTime() - new Date(m.created_at).getTime() > 1000; // >1s
  };

  const groupReactions = (reactions: any[]) => {
    const grouped = reactions.reduce((acc: Record<string, any[]>, r: any) => {
      (acc[r.emoji] ||= []).push(r);
      return acc;
    }, {});
    return Object.entries(grouped).map(([emoji, list]: [string, any[]]) => ({
      emoji,
      count: list.length,
      users: list.map((r) => r.sender_name || 'Unknown'),
      hasCurrentUser: !!currentUser && list.some((r) =>
        currentUser.type === 'admin' ? r.user_id === currentUser.id : r.sub_user_id === currentUser.id
      ),
    }));
  };

  const canEditMessage = (message: ChatMessage) => {
    if (!isOwnMessage(message) || isDeleted(message)) return false;
    if (message.message_type && message.message_type !== 'text') return false;
    const hoursDiff =
      (Date.now() - new Date(message.created_at).getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 12;
  };

  // ---------- changed: take the whole message, guard if deleted ----------
  const handleDeleteClick = (message: ChatMessage) => {
    if (isDeleted(message)) return; // safety
    setMessageToDelete(message.id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (messageToDelete) onDelete(messageToDelete);
    setMessageToDelete(null);
    setDeleteDialogOpen(false);
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Smile className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-2">
          This is the beginning of your conversation
        </h3>
        <p className="text-muted-foreground text-sm">Send a message to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        const prevMessage = messages[index - 1];
        const isFirstInGroup =
          !prevMessage ||
          prevMessage.sender_user_id !== message.sender_user_id ||
          prevMessage.sender_sub_user_id !== message.sender_sub_user_id ||
          new Date(message.created_at).getTime() -
            new Date(prevMessage.created_at).getTime() >
            300000; // 5m
        const reactions = groupReactions(message.reactions || []);
        const deleted = isDeleted(message);
        const edited = wasEdited(message);

        return (
          <div
            key={message.id}
            className={`group relative ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}
            onMouseEnter={() => setHoveredMessage(message.id)}
            onMouseLeave={() => setHoveredMessage(null)}
          >
            <div className="flex gap-3">
              {/* Avatar (only show for first message in group) */}
              <div className="w-10 flex-shrink-0">
                {isFirstInGroup ? (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={message.sender_avatar || ''} />
                    <AvatarFallback>{getInitials(message.sender_name || 'U')}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 flex items-center justify-center">
                    {hoveredMessage === message.id && (
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                {/* Header (name + time). NOTE: Admin badge removed */}
                {isFirstInGroup && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{message.sender_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      {edited && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <Edit className="h-3 w-3" />
                          {t('chat.edited')}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* Reply Context */}
                {message.reply_to && (
                  <div className="mb-2 pl-3 border-l-2 border-muted bg-muted/20 rounded py-1 px-2">
                    <p className="text-xs text-muted-foreground">
                      <Reply className="h-3 w-3 inline mr-1" />
                      Replying to{' '}
                      <span className="font-medium">{message.reply_to.sender_name}</span>
                    </p>
                    <p className="text-sm truncate">{message.reply_to.content}</p>
                  </div>
                )}

                {/* Message Text */}
                <div
                  className={`text-sm leading-relaxed ${
                    deleted ? 'text-muted-foreground italic' : 'text-foreground'
                  }`}
                >
                  {deleted ? `[${t('chat.messageDeleted')}]` : message.content}
                </div>

                {/* Files - hide if message is deleted */}
                {message.files && message.files.length > 0 && !deleted && (
                  <div className="mt-2 space-y-1">
                    {message.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 p-2 bg-muted rounded border"
                      >
                        <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                          📄
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.size ? `${Math.round(file.size / 1024)} KB` : 'File'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reactions */}
                {reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {reactions.map((reaction) => (
                      <div
                        key={reaction.emoji}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-muted border border-transparent"
                        title={`${reaction.users.join(', ')} reacted with ${reaction.emoji}`}
                      >
                        <span>{reaction.emoji}</span>
                        <span className="font-medium">{reaction.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions — hidden completely for deleted messages */}
              {hoveredMessage === message.id && !deleted && (
                <div className="absolute -top-2 right-0 flex items-center gap-1 bg-background border border-border rounded-lg p-1 shadow-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReply(message.id)}
                    className="h-6 w-6 p-0"
                    title="Reply to message"
                  >
                    <Reply className="h-3 w-3" />
                  </Button>

                  {/* Edit (own + within 12h + not deleted) */}
                  {isOwnMessage(message) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(message)}
                      className="h-6 w-6 p-0"
                      title={canEditMessage(message) ? 'Edit message' : 'Cannot edit this message'}
                      disabled={!canEditMessage(message)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Delete (own + not deleted) */}
                  {isOwnMessage(message) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(message)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      title="Delete message"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="z-[9999]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.deleteMessage')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('chat.deleteMessageConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('chat.cancelButton')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('chat.deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};