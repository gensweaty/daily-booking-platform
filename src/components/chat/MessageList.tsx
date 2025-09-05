import { useState } from 'react';
import { Reply, Edit, Trash2, Clock, Smile } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
// This type is now defined locally since we removed the separate useChat hook
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

export const MessageList = ({ messages, currentUser, onReply, onEdit, onDelete }: MessageListProps) => {
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOwnMessage = (message: ChatMessage) => {
    if (!currentUser) return false;
    
    // Enhanced logic to handle both admin and sub-user messages
    if (currentUser.type === 'admin' && message.sender_type === 'admin') {
      return message.sender_user_id === currentUser.id;
    }
    
    if (currentUser.type === 'sub_user' && message.sender_type === 'sub_user') {
      return message.sender_sub_user_id === currentUser.id;
    }
    
    return false;
  };

  const groupReactions = (reactions: any[]) => {
    const grouped = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction);
      return acc;
    }, {});

    return Object.entries(grouped).map(([emoji, reactionList]: [string, any]) => ({
      emoji,
      count: reactionList.length,
      users: reactionList.map((r: any) => r.sender_name || 'Unknown'),
      hasCurrentUser: reactionList.some((r: any) => {
        if (!currentUser) return false;
        if (currentUser.type === 'admin') {
          return r.user_id === currentUser.id;
        } else if (currentUser.type === 'sub_user') {
          return r.sub_user_id === currentUser.id;
        }
        return false;
      })
    }));
  };

  const canEditMessage = (message: ChatMessage) => {
    if (!isOwnMessage(message) || message.is_deleted) return false;
    if (message.message_type && message.message_type !== 'text') return false;
    
    // Check 12-hour limit
    const messageTime = new Date(message.created_at).getTime();
    const now = new Date().getTime();
    const hoursDiff = (now - messageTime) / (1000 * 60 * 60);
    
    return hoursDiff <= 12;
  };

  const handleDeleteClick = (messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (messageToDelete) {
      onDelete(messageToDelete);
      setMessageToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Smile className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-2">This is the beginning of your conversation</h3>
        <p className="text-muted-foreground text-sm">
          Send a message to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        const prevMessage = messages[index - 1];
        const isFirstInGroup = !prevMessage || 
          prevMessage.sender_user_id !== message.sender_user_id ||
          prevMessage.sender_sub_user_id !== message.sender_sub_user_id ||
          new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000; // 5 minutes

        const reactions = groupReactions(message.reactions || []);

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
                    <AvatarImage src={message.sender_avatar} />
                    <AvatarFallback>
                      {getInitials(message.sender_name || 'Unknown')}
                    </AvatarFallback>
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
                {/* Message Header (only for first in group) */}
                {isFirstInGroup && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {message.sender_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                    {message.sender_type === 'admin' && (
                      <Badge variant="secondary" className="text-xs">
                        Admin
                      </Badge>
                    )}
                  </div>
                )}

                {/* Reply Context */}
                {message.reply_to && (
                  <div className="mb-2 pl-3 border-l-2 border-muted bg-muted/20 rounded py-1 px-2">
                    <p className="text-xs text-muted-foreground">
                      <Reply className="h-3 w-3 inline mr-1" />
                      Replying to <span className="font-medium">{message.reply_to.sender_name}</span>
                    </p>
                    <p className="text-sm truncate">{message.reply_to.content}</p>
                  </div>
                )}

                {/* Message Text */}
                <div className={`text-sm leading-relaxed ${message.is_deleted ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                  {message.content}
                  {message.edited_at && !message.is_deleted && (
                    <span className="text-xs text-muted-foreground ml-2">
                      <Clock className="h-3 w-3 inline mr-1" />
                      edited
                    </span>
                  )}
                </div>

                {/* Files - hide if message is deleted */}
                {message.files && message.files.length > 0 && !message.is_deleted && (
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

              {/* Message Actions */}
              {hoveredMessage === message.id && !message.is_deleted && (
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
                  
                  {/* Edit button - show for own messages */}
                  {isOwnMessage(message) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(message)}
                      className="h-6 w-6 p-0"
                      title={canEditMessage(message) ? "Edit message" : "Cannot edit this message"}
                      disabled={!canEditMessage(message)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {/* Delete button - only for own messages */}
                  {isOwnMessage(message) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(message.id)}
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
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="z-[9999]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};