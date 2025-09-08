import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { resolveAvatarUrl } from './_avatar';
import { useToast } from '@/hooks/use-toast';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { getEffectivePublicEmail } from '@/utils/chatEmail';
import { useLanguage } from '@/contexts/LanguageContext';

const PAGE_SIZE = 40;

type Message = {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  sender_user_id?: string;
  sender_sub_user_id?: string;
  sender_type: 'admin' | 'sub_user';
  sender_name?: string;
  sender_avatar_url?: string;
  channel_id: string;
  has_attachments?: boolean;
  message_type?: string;
  is_deleted?: boolean;
  edited_at?: string;
  original_content?: string;
  _isUpdate?: boolean;
  attachments?: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
    public_url?: string;
    object_url?: string;
  }>;
};

interface ChatAreaProps {
  onMessageInputFocus?: () => void;
}

export const ChatArea = ({ onMessageInputFocus }: ChatAreaProps = {}) => {
  const { me, currentChannelId, boardOwnerId, isInitialized, realtimeEnabled } = useChat();
  const { toast } = useToast();
  const { t } = useLanguage();
  const location = useLocation();

  const effectiveEmail = getEffectivePublicEmail(location.pathname, me?.email);
  const isPublic = location.pathname.startsWith('/board/');

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [channelInfo, setChannelInfo] = useState<{ 
    name: string; 
    isDM: boolean; 
    dmPartner?: { name: string; avatar?: string } 
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState<string | null>(null);
  
  const cacheRef = useRef<Map<string, { items: Message[]; oldestCursor: string | null; hasMore: boolean }>>(new Map());
  const activeChannelId = currentChannelId;
  const headerCacheRef = useRef<Map<string, { name: string; isDM: boolean; dmPartner?: { name: string; avatar?: string } }>>(new Map());
  const [generalId, setGeneralId] = useState<string | null>(null);
  
  // Scroll to bottom function
  const scrollToBottom = (behavior: 'smooth' | 'instant' = 'smooth') => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  // helper: fetch a page (new RPCs first, fallback to old)
  const fetchPage = async (before?: string | null) => {
    const onPublicBoard = location.pathname.startsWith('/board/');
    if (onPublicBoard && me?.type === 'sub_user') {
      const { data, error } = await supabase.rpc('list_channel_messages_public_paged', {
        p_owner_id: boardOwnerId,
        p_channel_id: activeChannelId,
        p_requester_type: 'sub_user',
        p_requester_email: effectiveEmail!,
        p_limit: PAGE_SIZE,
        p_before: before ?? null,
      });
      return { data, error };
    } else {
      const { data, error } = await supabase.rpc('get_chat_messages_for_channel_paged', {
        p_board_owner_id: boardOwnerId,
        p_channel_id: activeChannelId,
        p_limit: PAGE_SIZE,
        p_before: before ?? null,
      });
      return { data, error };
    }
  };

  // 🔄 initial load: last page only
  useEffect(() => {
    let active = true;
    (async () => {
      if (!activeChannelId || !me || !boardOwnerId || !isInitialized) return;

      setLoading(true);
      
      // Check cache first
      const cached = cacheRef.current.get(activeChannelId);
      if (cached) {
        setMessages(cached.items);
        setOldestCursor(cached.oldestCursor);
        setHasMore(cached.hasMore);
        setLoading(false);
        setTimeout(() => scrollToBottom('instant'), 0);
        return;
      }

      const { data, error } = await fetchPage(null);
      if (!active) return;

      if (error) { 
        setLoading(false); 
        return; 
      }

      const normalized = (data || [])
        .map((m: any) => ({ 
          ...m, 
          sender_type: m.sender_type as 'admin'|'sub_user', 
          sender_name: m.sender_name?.trim() || undefined 
        }))
        .reverse();

      // batch attachments for this page
      const messagesWithAttachments = normalized.filter(m => m.has_attachments);
      const attachmentIds = messagesWithAttachments.map(m => m.id);
      let byMsg: Record<string, any[]> = {};

      if (attachmentIds.length) {
        const onPublicBoard = location.pathname.startsWith('/board/');
        if (onPublicBoard && me?.type === 'sub_user') {
          const { data: attRows } = await supabase.rpc('list_files_for_messages_public', {
            p_message_ids: attachmentIds
          });
          if (attRows) {
            byMsg = attRows.reduce((acc: any, a: any) => {
              (acc[a.message_id] ||= []).push({
                id: a.id,
                filename: a.filename,
                file_path: a.file_path,
                content_type: a.content_type,
                size: a.size,
              });
              return acc;
            }, {});
          }
        } else {
          const { data: atts } = await supabase
            .from('chat_message_files')
            .select('*')
            .in('message_id', attachmentIds);
          if (atts) {
            byMsg = atts.reduce((acc: any, a: any) => {
              (acc[a.message_id] ||= []).push({
                id: a.id,
                filename: a.filename,
                file_path: a.file_path,
                content_type: a.content_type,
                size: a.size,
              });
              return acc;
            }, {});
          }
        }
      }

      const withAtts = normalized.map(m => ({
        ...m,
        attachments: byMsg[m.id] || [],
      }));

      setMessages(withAtts);
      cacheRef.current.set(activeChannelId, { 
        items: withAtts, 
        oldestCursor: withAtts[0]?.created_at ?? null,
        hasMore: (data || []).length === PAGE_SIZE
      });
      
      setLoading(false);
      setOldestCursor(withAtts[0]?.created_at ?? null);
      setHasMore((data || []).length === PAGE_SIZE);
      setTimeout(() => scrollToBottom('instant'), 0);
    })();
    return () => { active = false; };
  }, [activeChannelId, boardOwnerId, me?.id, me?.email, isInitialized, location.pathname]);

  // Dummy handlers for now
  const handleReply = (message: Message) => setReplyingTo(message);
  const handleEdit = (message: Message) => setEditingMessage(message);
  const handleDeleteMessage = (messageId: string) => {};
  const handleCancelReply = () => setReplyingTo(null);
  const handleCancelEdit = () => setEditingMessage(null);
  const handleEditMessage = (messageId: string, content: string) => {};
  const send = async (body: string, attachments: any[]) => {};

  if (!activeChannelId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <MessageCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">{t('chat.selectChannel')}</h3>
          <p className="text-sm">{t('chat.selectChannelDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MessageCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <h2 className="font-semibold truncate">
            {channelInfo?.isDM && channelInfo.dmPartner
              ? channelInfo.dmPartner.name
              : (channelInfo?.name || t('chat.general'))}
          </h2>
          <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
            {channelInfo?.isDM ? t('chat.directMessage') : t('chat.channel')}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4">
            <div style={{ height: 1 }} />
            <MessageList
              messages={messages.map(m => ({
                ...m,
                updated_at: m.updated_at || m.created_at,
                sender_avatar: m.sender_avatar_url,
                files: m.attachments
              }))}
              currentUser={me ? {
                id: isPublic && me.type === 'sub_user' && me.email ? me.email : (resolvedCurrentUserId || me.id),
                type: me.type,
                name: me.name || (me as any)?.full_name || 'Me'
              } : null}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDeleteMessage}
              loading={loading}
            />
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div onFocus={onMessageInputFocus}>
        <MessageInput 
          onSendMessage={send}
          onEditMessage={handleEditMessage}
          placeholder="Type a message..."
          replyingTo={replyingTo ? {
            ...replyingTo,
            updated_at: replyingTo.updated_at || replyingTo.created_at,
            attachments: replyingTo.attachments
          } : null}
          onCancelReply={handleCancelReply}
          editingMessage={editingMessage ? {
            ...editingMessage,
            updated_at: editingMessage.updated_at || editingMessage.created_at,
            attachments: editingMessage.attachments
          } : null}
          onCancelEdit={handleCancelEdit}
        />
      </div>
    </div>
  );
};

export default ChatArea;