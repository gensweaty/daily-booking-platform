import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useChat } from './ChatProvider';
import { resolveAvatarUrl } from './_avatar';
import { useToast } from '@/hooks/use-toast';
import { MessageInput } from './MessageInput';
import { MessageAttachments } from './MessageAttachments';
import { getEffectivePublicEmail } from '@/utils/chatEmail';

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_user_id?: string;
  sender_sub_user_id?: string;
  sender_type: 'admin' | 'sub_user';
  sender_name?: string;
  sender_avatar_url?: string;
  channel_id: string;
  has_attachments?: boolean;
  message_type?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
    public_url?: string;  // optimistic
    object_url?: string;  // optimistic
  }>;
};

interface ChatAreaProps {
  onMessageInputFocus?: () => void;
}

export const ChatArea = ({ onMessageInputFocus }: ChatAreaProps = {}) => {
  const { me, currentChannelId, boardOwnerId, isInitialized, realtimeEnabled } = useChat();
  const { toast } = useToast();
  const location = useLocation();

  // Compute effective email using the same logic as ChatSidebar
  const effectiveEmail = getEffectivePublicEmail(location.pathname, me?.email);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelInfo, setChannelInfo] = useState<{ 
    name: string; 
    isDM: boolean; 
    dmPartner?: { name: string; avatar?: string } 
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const cacheRef = useRef<Map<string, Message[]>>(new Map());
  const activeChannelId = currentChannelId;

  // helper for clean display names
  const nameFor = (m: Message) =>
    (m.sender_name && m.sender_name.trim())
    || (me?.name?.trim() || (me as any)?.full_name?.trim())
    || 'User';

  // Helper to infer DM header from cached messages when RPCs don't work
  const inferDMHeaderFromMessages = (
    msgs: Message[],
    meObj: any
  ): { name: string; isDM: boolean; dmPartner?: { name: string; avatar?: string } } | null => {
    if (!msgs?.length) return null;

    const myType = meObj?.type as 'admin' | 'sub_user' | undefined;
    const myId   = meObj?.id as string | undefined;

    // newest → oldest
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      const msgSenderId   = m.sender_type === 'admin' ? m.sender_user_id : m.sender_sub_user_id;
      const msgSenderType = m.sender_type;

      // Prefer "the other participant"
      const isMeById   = !!myId && !!msgSenderId && myId === msgSenderId && myType === msgSenderType;
      const isLikelyOther =
        !isMeById &&
        (
          // if we know my type, prefer the opposite type first
          (myType ? msgSenderType !== myType : true) ||
          // or same type but different id
          (!!myId && !!msgSenderId && msgSenderId !== myId)
        );

      if (isLikelyOther) {
        const partnerName   = (m.sender_name && m.sender_name.trim()) || undefined;
        const partnerAvatar = m.sender_avatar_url || undefined;
        if (partnerName) {
          return { name: partnerName, isDM: true, dmPartner: { name: partnerName, avatar: partnerAvatar } };
        }
      }
    }
    return null;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!activeChannelId && isInitialized) {
        console.log('⏰ Timeout fallback: no channel selected after 3 seconds');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [activeChannelId, isInitialized]);

  useEffect(() => {
    let active = true;
    (async () => {
      console.log('🔍 ChatArea header effect triggered:', { 
        activeChannelId, 
        boardOwnerId, 
        me_email: me?.email, 
        me_type: me?.type, 
        me_id: me?.id, 
        pathname: location.pathname 
      });
      
      if (!activeChannelId) { 
        console.log('🔍 No active channel, clearing channel info');
        if (active) setChannelInfo(null); 
        return; 
      }

      const onPublic = location.pathname.startsWith('/board/');
      console.log('🔍 Route check:', { onPublic, pathname: location.pathname, meType: me?.type });
      
      if (onPublic && boardOwnerId && effectiveEmail) {
        console.log('🔍 Calling get_channel_header_public with:', {
          p_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_requester_email: effectiveEmail,
        });
        
        const { data: hdr, error } = await supabase.rpc('get_channel_header_public', {
          p_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_requester_email: effectiveEmail,   // ← was me.email
        });
        
        console.log('🔍 Public header response:', { data: hdr, error });
        
        if (active && hdr?.length) {
          const row = hdr[0];
          const isDm = !!row.is_dm;
          console.log('🔍 Public header data:', { isDm, partner_name: row.partner_name, name: row.name, row });
          setChannelInfo({
            name: isDm ? (row.partner_name || 'Direct Message') : (row.name || 'General'),
            isDM: isDm,
            dmPartner: isDm ? { name: row.partner_name, avatar: row.partner_avatar_url } : undefined,
          });
          return;
        }
      }

      // Internal/admin or authenticated viewer
      if (boardOwnerId && me?.id && me?.type) {
        console.log('🔍 Calling get_channel_header_internal with:', {
          p_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_viewer_id: me.id,
          p_viewer_type: me.type,
        });
        
        const { data: hdrInt, error } = await supabase.rpc('get_channel_header_internal', {
          p_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_viewer_id: me.id,
          p_viewer_type: me.type,
        });
        
        console.log('🔍 Internal header response:', { data: hdrInt, error });
        
        if (active && hdrInt?.length) {
          const row = hdrInt[0];
          const isDm = !!row.is_dm;
          console.log('🔍 Internal header data:', { isDm, partner_name: row.partner_name, name: row.name, row });
          setChannelInfo({
            name: isDm ? (row.partner_name || 'Direct Message') : (row.name || 'General'),
            isDM: isDm,
            dmPartner: isDm ? { name: row.partner_name, avatar: row.partner_avatar_url } : undefined,
          });
          return;
        } else {
          console.log('🔍 No internal header data returned or error occurred');
        }
      } else {
        console.log('🔍 Missing required data for internal header:', { boardOwnerId, me_id: me?.id, me_type: me?.type });
      }
      
      // Try to infer DM header from cached messages if RPCs didn't set channelInfo
      if (active && !channelInfo) {
        const cached = cacheRef.current.get(activeChannelId) || [];
        const inferred = inferDMHeaderFromMessages(cached, me);
        if (inferred) {
          console.log('🔍 Inferred DM header from messages:', inferred);
          setChannelInfo(inferred);
          return;
        }
      }
      
      // Final fallback
      console.log('🔍 Using fallback channel info');
      if (active) {
        setChannelInfo({
          name: 'General',
          isDM: false,
          dmPartner: undefined,
        });
      }
    })();
    return () => { active = false; };
  }, [activeChannelId, boardOwnerId, me?.email, me?.type, me?.id, location.pathname]);

  useEffect(() => {
    let active = true;

    const loadMessages = async () => {
      if (!activeChannelId || !me || !boardOwnerId || !isInitialized) return;

      try {
        const onPublicBoard = location.pathname.startsWith('/board/');
        const { data: { session } } = await supabase.auth.getSession();
        const isAuthed = !!session?.user?.id;

        let data, error;
        if (onPublicBoard && me?.type === 'sub_user') {
          const result = await supabase.rpc('list_channel_messages_public', {
            p_owner_id: boardOwnerId,
            p_channel_id: activeChannelId,
            p_requester_type: 'sub_user',
            p_requester_email: effectiveEmail!,
          });
          data = result.data;
          error = result.error;
        } else {
          const result = await supabase.rpc('get_chat_messages_for_channel', {
            p_board_owner_id: boardOwnerId,
            p_channel_id: activeChannelId,
          });
          data = result.data;
          error = result.error;
        }

        if (error) { if (active) setLoading(false); return; }

        if (active) {
          const normalized = (data || []).map((m: any) => ({
            ...m,
            sender_type: m.sender_type as 'admin' | 'sub_user',
            // ensure we always show *something* sensible
            sender_name: (m.sender_name && m.sender_name.trim()) || undefined,
          }));

          // fetch attachments
          const ids = normalized.map(m => m.id);
          let byMsg: Record<string, any[]> = {};
          if (ids.length) {
            if (onPublicBoard && me?.type === 'sub_user') {
              // RLS-safe path for sub-users on external board
              const { data: attRows } = await supabase.rpc('list_files_for_messages_public', {
                p_message_ids: ids
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
              // existing direct select for authenticated
              const { data: atts } = await supabase
                .from('chat_message_files')
                .select('*')
                .in('message_id', ids);
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
          cacheRef.current.set(activeChannelId, withAtts);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    };

    loadMessages();
    return () => { active = false; };
  }, [activeChannelId, boardOwnerId, me?.id, me?.email, isInitialized, location.pathname]);

  // NEW EFFECT: Infer DM header after messages load
  useEffect(() => {
    if (!activeChannelId) return;
    if (!messages?.length) return;

    // If we don't have DM header yet or it still shows as a channel, try to infer
    if (!channelInfo || !channelInfo.isDM || !channelInfo.dmPartner?.name) {
      const inferred = inferDMHeaderFromMessages(messages, me);
      if (inferred) setChannelInfo(inferred);
    }
  }, [messages, activeChannelId]);  // ← intentionally NOT depending on channelInfo

  useEffect(() => {
    if (!activeChannelId) { setMessages([]); setLoading(true); return; }
    const cached = cacheRef.current.get(activeChannelId);
    if (cached?.length) { setMessages(cached); setLoading(false); }
    else { setLoading(true); }
  }, [activeChannelId]);

  // polling for public (only when realtime disabled)
  useEffect(() => {
    if (!activeChannelId || !boardOwnerId || !me) return;
    if (realtimeEnabled) return;

    let mounted = true;
    const guardKey = `${boardOwnerId}:${me.email || me.id}`;

    const poll = async () => {
      if (!mounted) return;
      const slug = location.pathname.split('/').pop();
      const accessData = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');

      const { data } = await supabase.rpc('list_channel_messages_public', {
        p_owner_id: boardOwnerId,
        p_channel_id: activeChannelId,
        p_requester_type: 'sub_user',
        p_requester_email: effectiveEmail!,
      });
      if (!mounted || !data) return;

      setMessages(prev => {
        const prevIds = new Set(prev.map(m => m.id));
        const byId = new Map(prev.map(m => [m.id, m]));
        for (const m of data) {
          // Only emit for truly new ids; Map.set below already overwrites to latest snapshot
          if (!prevIds.has(m.id)) {
            window.dispatchEvent(new CustomEvent('chat-message-received', { detail: { message: { ...m, owner_id: boardOwnerId } } }));
          }
          byId.set(m.id, { ...m, sender_type: m.sender_type as 'admin' | 'sub_user' });
        }
        return Array.from(byId.values()).sort((a,b) => +new Date(a.created_at) - +new Date(b.created_at));
      });
    };

    const id = setInterval(poll, 2500);
    poll();
    return () => { mounted = false; clearInterval(id); };
  }, [activeChannelId, boardOwnerId, me?.email, me?.id, location.pathname, realtimeEnabled]);

  useEffect(() => {
    const handleMessage = async (event: CustomEvent) => {
      let { message } = event.detail as { message: Message };
      const channelId = message.channel_id;

      if (message.has_attachments) {
        const { data: atts } = await supabase.from('chat_message_files').select('*').eq('message_id', message.id);
        message = { ...message, attachments: (atts || []).map(a => ({
          id: a.id, filename: a.filename, file_path: a.file_path, content_type: a.content_type, size: a.size,
        }))};
      }

      const currentCache = cacheRef.current.get(channelId) || [];
      const existsInCache = currentCache.some(m => m.id === message.id);
      if (!existsInCache) {
        const updatedCache = [...currentCache, message];
        cacheRef.current.set(channelId, updatedCache);
        if (channelId === activeChannelId) {
          setMessages(prev => {
            const existsInUI = prev.some(m => m.id === message.id);
            if (existsInUI) return prev;
            return [...prev, message];
          });
        }
      }
    };

    window.addEventListener('chat-message-received', handleMessage as EventListener);
    return () => window.removeEventListener('chat-message-received', handleMessage as EventListener);
  }, [activeChannelId]);

  useEffect(() => {
    const onReset = () => {
      cacheRef.current.clear();
      setMessages([]);
      setLoading(false);
    };
    window.addEventListener('chat-reset', onReset as EventListener);
    return () => window.removeEventListener('chat-reset', onReset as EventListener);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async (content: string, attachments: any[] = []) => {
    if (!content.trim() && attachments.length === 0) return;
    if (!activeChannelId || !boardOwnerId || !me) return;

    // Ensure message body is never empty (use single space when files only)
    const body = content.trim().length > 0 ? content.trim() : ' ';

    // --- optimistic paint
    const tempId = `temp_${Date.now()}`;
    const optimisticAtts = attachments.map((a: any) => {
      const { data } = supabase.storage.from('chat_attachments').getPublicUrl(a.file_path);
      return {
        id: `tmp_${Math.random().toString(36).slice(2)}`,
        filename: a.filename,
        file_path: a.file_path,
        content_type: a.content_type,
        size: a.size,
        public_url: a.public_url || data.publicUrl,
        object_url: a.object_url,
      };
    });

    const optimisticMessage: Message = {
      id: tempId,
      content: body,
      created_at: new Date().toISOString(),
      sender_type: me.type as 'admin' | 'sub_user',
      sender_name: (me.name || (me as any)?.full_name || 'Me'),
      sender_avatar_url: me.avatarUrl || undefined,
      channel_id: activeChannelId,
      has_attachments: optimisticAtts.length > 0,
      message_type: optimisticAtts.length ? 'file' : 'text',
      attachments: optimisticAtts,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    // helper: fetch the latest message id the server just created
    const fetchLatestMessage = async () => {
      const { data: msg } = await supabase
        .from('chat_messages')
        .select('id, created_at, content, channel_id, has_attachments, message_type, sender_type, sender_user_id, sender_sub_user_id, sender_name, sender_avatar_url')
        .eq('channel_id', activeChannelId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return msg || null;
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthed = !!session?.user?.id;
      const onPublicBoard = location.pathname.startsWith('/board/');

      // New flow for public board sub-users
      if (onPublicBoard && me?.type === 'sub_user') {
        const { data: created, error } = await supabase.rpc('send_public_board_message', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_sender_email: me.email!,
          p_content: body,
        });
        if (error) throw error;

        const messageId = created?.[0]?.id;
        if (attachments.length && messageId) {
          await supabase.rpc('attach_files_to_message_public_by_id', {
            p_owner_id: boardOwnerId,
            p_message_id: messageId,
            p_files: attachments,
          });
        }

        // get linked files via RLS-safe list
        let atts: any[] = [];
        if (attachments.length && messageId) {
          const { data: attRows } = await supabase.rpc('list_files_for_messages_public', {
            p_message_ids: [messageId],
          });
          atts = (attRows || []).map(a => ({ ...a }));
        }

        const hydrated: Message = {
          id: messageId,
          content: body,
          created_at: created?.[0]?.created_at || new Date().toISOString(),
          sender_type: 'sub_user',
          sender_name: created?.[0]?.sender_name || me.name || (me as any)?.full_name || 'Me',
          sender_avatar_url: created?.[0]?.sender_avatar_url || me.avatarUrl,
          channel_id: activeChannelId,
          has_attachments: atts.length > 0,
          message_type: atts.length ? 'file' : 'text',
          attachments: atts,
        };

        // replace optimistic AND any pre-fetched "real" stub with the hydrated one
        setMessages(prev => {
          const withoutTempOrReal = prev.filter(
            m => m.id !== tempId && m.id !== messageId
          );
          return [...withoutTempOrReal, hydrated];
        });
        // No-op: local state is already updated; poller/realtime will converge
        return;
      }

      // Original flow for authenticated users
      if (isAuthed && me?.type === 'admin') {
        const { error } = await supabase.rpc('send_authenticated_message', {
          p_channel_id: activeChannelId,
          p_owner_id: boardOwnerId,
          p_content: body,
        });
        if (error) throw error;
      } else {
        // Fallback public flow
        const slug = location.pathname.split('/').pop()!;
        const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
        const senderEmail = me?.email || stored?.email;
        const { error } = await supabase.rpc('send_public_board_message', {
          p_board_owner_id: boardOwnerId,
          p_channel_id: activeChannelId,
          p_sender_email: senderEmail,
          p_content: body,
        });
        if (error) throw error;
      }

      // get the just-created message
      const real = await fetchLatestMessage();
      if (!real?.id) return;

      // link files to that message
      if (attachments.length > 0) {
        if (me?.type === 'admin' && isAuthed) {
          const rows = attachments.map(a => ({
            message_id: real.id,
            filename: a.filename,
            file_path: a.file_path,
            content_type: a.content_type,
            size: a.size,
          }));
          await supabase.from('chat_message_files').insert(rows);
          await supabase.from('chat_messages')
            .update({ has_attachments: true, message_type: 'file' })
            .eq('id', real.id);
        } else {
          const slug = location.pathname.split('/').pop()!;
          const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
          const senderEmail = stored?.email || me.email;

          await supabase.rpc('attach_files_to_message_public', {
            p_owner_id: boardOwnerId,
            p_channel_id: activeChannelId,
            p_sender_email: senderEmail,
            p_files: attachments,
          });
        }
      }

      // hydrate with attachments
      let atts: any[] = [];
      if (attachments.length > 0) {
        if (me?.type === 'sub_user' && location.pathname.startsWith('/board/')) {
          // Use RLS-safe RPC for sub-users on external board
          const { data: attRows } = await supabase.rpc('list_files_for_messages_public', {
            p_message_ids: [real.id]
          });
          atts = (attRows || []).map(a => ({
            id: a.id, filename: a.filename, file_path: a.file_path,
            content_type: a.content_type, size: a.size,
          }));
        } else {
          // Direct select for authenticated users
          const { data: linked } = await supabase
            .from('chat_message_files')
            .select('*')
            .eq('message_id', real.id);
          atts = (linked || []).map(a => ({
            id: a.id, filename: a.filename, file_path: a.file_path, content_type: a.content_type, size: a.size,
          }));
        }
      }

      const hydrated: Message = {
        ...real,
        sender_type: real.sender_type as 'admin' | 'sub_user',
        sender_name: (real.sender_name && real.sender_name.trim())
          || (me.name || (me as any)?.full_name || 'Me'),
        // Prefer what DB saved for sender avatar; only fall back to local
        sender_avatar_url: (real as any).sender_avatar_url
          ?? me.avatarUrl
          ?? undefined,
        attachments: atts,
      };

      // replace optimistic; also guard against duplicates by id
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId && m.id !== real.id);
        return [...withoutTemp, hydrated];
      });

      // dispatch once so other views update; id-based guards will avoid dupes
      window.dispatchEvent(new CustomEvent('chat-message-received', { detail: { message: hydrated } }));
    } catch (e: any) {
      // rollback optimistic
      setMessages(prev => prev.filter(m => m.id !== tempId));
      console.error('❌ Send error:', e);
      toast({
        title: 'Error',
        description: e.message || 'Failed to send',
        variant: 'destructive',
      });
    }
  };

  if (loading || !isInitialized) {
    return (
      <div className="grid grid-rows-[auto,1fr,auto] h-full overflow-hidden bg-background">
        <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
          <MessageCircle className="h-5 w-5 animate-pulse" />
          <h2 className="font-semibold">Loading...</h2>
        </div>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading chat...</p>
            <p className="text-xs text-muted-foreground">Initializing chat system...</p>
          </div>
        </div>
        <div className="p-4 border-t bg-muted/30">
          <div className="bg-muted rounded-md h-10 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-rows-[auto,1fr,auto] h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
        {channelInfo?.isDM && channelInfo?.dmPartner?.avatar ? (
          <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            <img
              src={resolveAvatarUrl(channelInfo.dmPartner.avatar)!}
              alt={channelInfo.dmPartner.name}
              className="h-full w-full object-cover"
            />
          </div>
        ) : channelInfo?.isDM ? (
          <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-foreground">
              {(channelInfo?.dmPartner?.name || "U").slice(0, 2).toUpperCase()}
            </span>
          </div>
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
        <h2 className="font-semibold">
          {channelInfo?.isDM
            ? (channelInfo?.dmPartner?.name || 'Direct Message')
            : (channelInfo?.name || 'General')}
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
          {channelInfo?.isDM ? 'Direct Message' : 'Channel'}
        </span>
      </div>

      {/* Messages */}
      <div className="overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                {channelInfo?.isDM 
                  ? `Start a conversation!`
                  : `Welcome to #${channelInfo?.name || 'general'}. Start chatting with your team!`
                }
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                    {resolveAvatarUrl(message.sender_avatar_url) ? (
                      <img 
                        src={resolveAvatarUrl(message.sender_avatar_url)!} 
                        alt={message.sender_name || "User"} 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium">
                        {(nameFor(message) || "U").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {nameFor(message)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    {message.attachments && message.attachments.length > 0 && (
                      <MessageAttachments attachments={message.attachments} />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div onFocus={onMessageInputFocus}>
        <MessageInput 
          onSendMessage={send}
          placeholder="Type a message..."
        />
      </div>
    </div>
  );
};
