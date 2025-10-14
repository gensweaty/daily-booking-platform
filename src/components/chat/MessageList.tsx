import { useState } from 'react';
import { Reply, Edit, Trash2, Smile, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
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
import { MessageAttachments } from './MessageAttachments';
import { supabase } from '@/integrations/supabase/client';

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
  files?: any[];                     // sometimes used
  attachments?: any[];               // sometimes used (older shape)
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
  isAITyping?: boolean;
}

export const MessageList = ({
  messages,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  isAITyping = false,
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
      return (
        message.sender_sub_user_id === currentUser.id ||
        (message.sender_name === currentUser.name && currentUser.id?.includes('@'))
      );
    }
    return false;
  };

  // -- robust deleted check
  const isDeleted = (m: ChatMessage) => {
    if (m.is_deleted) return true;
    if (m.message_type === 'deleted') return true;
    const c = (m.content || '').trim().toLowerCase();
    return c === 'message deleted' || c === '[message deleted]';
  };

  // -- robust edited check (matches your back-end behaviors)
  const wasEdited = (m: ChatMessage) => {
    if (isDeleted(m)) return false;

    // 🔧 FIX: Only show as edited if there's explicit edit evidence
    // Check for explicit edit flags first
    // @ts-ignore
    if (m.edited_at || (m as any).is_edited === true) return true;

    // Content changed (if original was sent) - this is the most reliable indicator
    if (m.original_content && m.original_content.trim() !== (m.content || "").trim()) return true;

    // 🔧 CRITICAL FIX: NEVER mark messages with attachments as edited based on timestamps alone
    // File uploads cause the backend to update timestamps after creation, but this is NOT an edit
    const hasFileAttachments = (m.attachments && m.attachments.length > 0) || 
                               (m.files && m.files.length > 0) || 
                               ((m as any).has_attachments === true);
    
    // If message has file attachments, don't consider timestamp differences as edits
    if (hasFileAttachments) return false;
    
    // For non-file messages, significant timestamp differences might indicate edits
    if (m.updated_at && m.created_at) {
      const timeDiff = new Date(m.updated_at).getTime() - new Date(m.created_at).getTime();
      // Only consider it edited if updated more than 1 second after creation (allows for minor DB delays)
      if (timeDiff > 1000) return true;
    }

    return false;
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
      hasCurrentUser:
        !!currentUser &&
        list.some((r) => (currentUser.type === 'admin' ? r.user_id === currentUser.id : r.sub_user_id === currentUser.id)),
    }));
  };

  const canEditMessage = (message: ChatMessage) => {
    if (!isOwnMessage(message) || isDeleted(message)) return false;
    if (message.message_type && message.message_type !== 'text') return false;
    const hoursDiff = (Date.now() - new Date(message.created_at).getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 12;
  };

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

  // ---- normalize attachments for MessageAttachments component
  const normalizeAttachments = (message: ChatMessage) => {
    const raw = (message.files && message.files.length ? message.files : message.attachments) || [];
    return raw
      .map((a: any) => {
        const file_path =
          a.file_path ?? a.path ?? a.filepath ?? a.storage_path ?? a.full_path ?? a.key ?? null;
        let public_url = a.public_url ?? a.preview_url ?? null;

        if (!public_url && file_path) {
          // Normalize file path before calling getPublicUrl
          const pathOnly = file_path.replace(/^chat_attachments\//, '');
          const { data } = supabase.storage.from('chat_attachments').getPublicUrl(pathOnly);
          public_url = data?.publicUrl || null;
        }

        return {
          id: a.id ?? a.file_id ?? a.attachment_id ?? `${message.id}_${(a.filename || a.name || 'file')}`,
          filename: a.filename ?? a.name ?? a.file_name ?? (file_path ? file_path.split('/').pop() : 'file'),
          file_path,
          content_type: a.content_type ?? a.mimetype ?? a.mime_type ?? a.type ?? undefined,
          size: a.size ?? a.bytes ?? a.length ?? undefined,
          public_url,
          object_url: a.object_url ?? undefined,
        };
      })
      .filter((a: any) => !!a.file_path);
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Smile className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-2">This is the beginning of your conversation</h3>
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
          new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000; // 5m

        const reactions = groupReactions(message.reactions || []);
        const deleted = isDeleted(message);
        const edited = wasEdited(message);
        const normalizedAtts = !deleted ? normalizeAttachments(message) : [];

        return (
          <div
            key={message.id}
            className={`group relative ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}
            onMouseEnter={() => setHoveredMessage(message.id)}
            onMouseLeave={() => setHoveredMessage(null)}
          >
            <div className="flex gap-3">
              {/* Avatar (first in group only) */}
              <div className="w-10 flex-shrink-0">
                {isFirstInGroup ? (
                  message.sender_name === 'Smartbookly AI' ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-sm">
                      <span className="text-white text-lg">🤖</span>
                    </div>
                  ) : (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={message.sender_avatar || ''} />
                      <AvatarFallback>{getInitials(message.sender_name || 'U')}</AvatarFallback>
                    </Avatar>
                  )
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

              {/* Body */}
              <div className="flex-1 min-w-0">
                {/* Header row (name • time • edited) — Admin badge removed */}
                {isFirstInGroup && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{message.sender_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                    {edited && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Edit className="h-3 w-3" />
                        {t('chat.edited')}
                      </span>
                    )}
                  </div>
                )}

                {/* If not first in group, still show edited marker so it never gets lost */}
                {!isFirstInGroup && edited && (
                  <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                    <Edit className="h-3 w-3" />
                    {t('chat.edited')}
                  </div>
                )}

                {/* Reply context */}
                {message.reply_to && (
                  <div className="mb-2 pl-3 border-l-2 border-muted bg-muted/20 rounded py-1 px-2">
                    <p className="text-xs text-muted-foreground">
                      <Reply className="h-3 w-3 inline mr-1" />
                      Replying to <span className="font-medium">{message.reply_to.sender_name}</span>
                    </p>
                    <p className="text-sm truncate">{message.reply_to.content}</p>
                  </div>
                )}

                {/* Text */}
                <div className={`text-sm leading-relaxed ${deleted ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                  {deleted ? (
                    `[${t('chat.messageDeleted')}]`
                  ) : (
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            className="text-primary hover:underline font-medium"
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        ),
                        p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                        strong: ({ node, ...props }) => <strong {...props} className="font-semibold" />,
                        code: ({ node, ...props }) => (
                          <code {...props} className="bg-muted px-1 py-0.5 rounded text-sm" />
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                </div>

                {/* Attachments — use your existing rich component so thumbnails & popup work again */}
                {normalizedAtts.length > 0 && (
                  <div className="mt-2">
                    <MessageAttachments attachments={normalizedAtts} />
                  </div>
                )}

                {/* Reactions */}
                {reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {reactions.map((r) => (
                      <div
                        key={r.emoji}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-muted border border-transparent"
                        title={`${r.users.join(', ')} reacted with ${r.emoji}`}
                      >
                        <span>{r.emoji}</span>
                        <span className="font-medium">{r.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions — never shown for deleted messages */}
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

      {/* AI Typing Indicator */}
      {isAITyping && (
        <div className="group relative mt-4">
          <div className="flex gap-3">
            <div className="w-10 flex-shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">Smartbookly AI</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm italic">AI is thinking...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.deleteMessage')}</AlertDialogTitle>
            <AlertDialogDescription>{t('chat.deleteMessageConfirm')}</AlertDialogDescription>
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