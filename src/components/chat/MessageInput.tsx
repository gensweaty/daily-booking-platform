import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, X, FileText, Image as ImageIcon, FileSpreadsheet, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChatMessage } from '@/hooks/useChatMessages';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useToast } from '@/hooks/use-toast';
import { AIQuickPrompts } from './AIQuickPrompts';

interface MessageInputProps {
  onSendMessage: (content: string, attachments?: any[]) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  placeholder?: string;
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  currentChannelId?: string | null;
  isAIChannel?: boolean;
  boardOwnerId?: string;
  userTimezone?: string;
  onAISending?: (isSending: boolean) => void;
}

const ALLOWED_MIME: Record<string, string[]> = {
  image: ['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/bmp','image/svg+xml'],
  pdf: ['application/pdf'],
  word: ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/rtf'],
  excel: ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'],
  ppt: ['application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'],
};

const isAllowed = (file: File) => {
  const t = (file.type || '').toLowerCase();
  if (Object.values(ALLOWED_MIME).some(list => list.includes(t))) return true;
  // fallback by extension (covers some browsers that give generic types)
  const n = file.name.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|pdf|docx?|rtf|xlsx?|csv|pptx?)$/.test(n);
};

const iconForName = (name: string, type: string) => {
  const n = name.toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n)) return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
  if (n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv')) return <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />;
  if (n.endsWith('.ppt') || n.endsWith('.pptx')) return <Presentation className="h-4 w-4 text-muted-foreground" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
};

export const MessageInput = ({ 
  onSendMessage,
  onEditMessage,
  placeholder,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  currentChannelId,
  isAIChannel = false,
  boardOwnerId,
  userTimezone,
  onAISending
}: MessageInputProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingAI, setIsSendingAI] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const defaultPlaceholder = placeholder || t('chat.typeMessage');

  const uploadAndSend = async () => {
    setIsUploading(true);
    try {
      if (editingMessage) {
        // Handle editing
        if (onEditMessage && message.trim()) {
          await onEditMessage(editingMessage.id, message.trim());
          setMessage('');
          if (onCancelEdit) onCancelEdit();
        }
      } else if (isAIChannel && currentChannelId && boardOwnerId) {
        // Handle AI channel message with file support
        console.log('🤖 Sending message to AI channel with attachments:', attachments.length);
        
        // Upload attachments if any
        let uploadedFiles: any[] = [];
        if (attachments.length > 0) {
          for (const file of attachments) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage.from('chat_attachments').upload(filePath, file);
            if (uploadError) {
              console.error('Upload error:', uploadError);
              toast({ title: "Upload failed", description: `Could not upload ${file.name}`, variant: "destructive" });
              continue;
            }

            const { data: pub } = supabase.storage.from('chat_attachments').getPublicUrl(filePath);
            uploadedFiles.push({
              filename: file.name,
              file_path: filePath,
              content_type: file.type || undefined,
              size: file.size,
              public_url: pub.publicUrl,
            });
          }
        }
        
        // Get current user info with proper name resolution
        const { data: { user } } = await supabase.auth.getUser();
        let senderName = 'User';
        let senderType: 'admin' | 'sub_user' = 'admin';

        console.log('🔍 [AI SENDER RESOLUTION START]', {
          userId: user?.id,
          userEmail: user?.email,
          boardOwnerId,
          pathname: window.location.pathname,
          userMetadata: user?.user_metadata
        });

        // 1) Public board visitor identity (unchanged)
        const isOnPublicBoard = window.location.pathname.startsWith('/public/');
        const publicBoardSlug = isOnPublicBoard ? window.location.pathname.split('/').pop() : null;

        if (isOnPublicBoard && publicBoardSlug) {
          console.log('🌍 Public board visitor detected', { publicBoardSlug });
          const stored = JSON.parse(localStorage.getItem(`public-board-access-${publicBoardSlug}`) || '{}');
          if (stored.email) {
            const { data: subUser } = await supabase
              .from('sub_users')
              .select('fullname, email')
              .eq('board_owner_id', boardOwnerId)
              .eq('email', stored.email)
              .maybeSingle();

            console.log('🔎 Public sub-user lookup result:', subUser);
            if (subUser) {
              senderName = subUser.fullname || stored.name || stored.email.split('@')[0];
              senderType = 'sub_user';
            }
          }
        }
        // 2) Authenticated sub-user session (NEW: trust auth metadata first)
        else if (user?.user_metadata?.role === 'sub_user') {
          console.log('👤 Auth metadata indicates sub_user');
          senderType = 'sub_user';
          senderName =
            (user.user_metadata.full_name as string) ||
            (user.user_metadata.username as string) ||
            (user.email?.split('@')[0] ?? 'User');
          console.log('✅ Sub-user from auth metadata:', { senderName, senderType });
        }
        // 3) Authenticated admin/owner (fallbacks kept as-is)
        else if (user) {
          console.log('🔍 Checking if authenticated user is a sub-user via database...');
          
          // CRITICAL FIX: Try to match sub_user by their auth user ID first (direct match)
          const { data: subUserById, error: subUserByIdError } = await supabase
            .from('sub_users')
            .select('id, fullname, email, board_owner_id')
            .eq('id', user.id)
            .maybeSingle();

          console.log('🔎 Sub-user by ID lookup:', {
            searchUserId: user.id,
            result: subUserById,
            error: subUserByIdError
          });

          // If found by ID, this is definitely a sub-user
          if (subUserById?.fullname) {
            console.log('✅ Found sub-user by auth ID:', subUserById.fullname);
            senderName = subUserById.fullname;
            senderType = 'sub_user';
            // Update boardOwnerId to be the actual board owner for AI function
            boardOwnerId = subUserById.board_owner_id;
          } else {
            // Fallback: Try to match an existing sub_user by email (covers legacy setups)
            const { data: subUser, error: subUserError } = await supabase
              .from('sub_users')
              .select('fullname, email, board_owner_id')
              .eq('board_owner_id', boardOwnerId)
              .ilike('email', user.email ?? '')
              .maybeSingle();

            console.log('🔎 Sub-user by email lookup:', {
              searchEmail: user.email,
              searchBoardOwnerId: boardOwnerId,
              result: subUser,
              error: subUserError
            });

            if (subUser?.fullname) {
              console.log('✅ Found sub-user by email:', subUser.fullname);
              senderName = subUser.fullname;
              senderType = 'sub_user';
            } else {
              console.log('👔 Treating as admin user');
              const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', user.id)
                .maybeSingle();

              console.log('📋 Admin profile lookup:', profile);

              // Use profile username only if it's not an auto-generated "user_..."
              if (profile?.username && !profile.username.startsWith('user_')) {
                senderName = profile.username;
              } else {
                senderName = user.email?.split('@')[0] || 'User';
              }
              senderType = 'admin';
            }
          }
        }

        console.log('✨ [AI SENDER RESOLUTION FINAL]', { senderName, senderType });
        
        // Get recent conversation history (last 20 messages)
        const { data: recentMessages } = await supabase
          .from('chat_messages')
          .select('sender_type, content')
          .eq('channel_id', currentChannelId)
          .eq('owner_id', boardOwnerId)
          .order('created_at', { ascending: false })
          .limit(20);

        const conversationHistory = (recentMessages || [])
          .reverse()
          .map(msg => ({
            role: msg.sender_type === 'system' ? 'assistant' : 'user',
            content: msg.content
          }));

        // Send user message with attachments
        onSendMessage(message.trim(), uploadedFiles);
        const userMessage = message.trim();
        setMessage('');
        setAttachments([]);
        setIsSendingAI(true);
        if (onAISending) onAISending(true);
        
        // Call AI edge function (it will insert the AI response)
        try {
          // Get current local time from browser
          const now = new Date();
          const localTimeISO = now.toISOString();
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const tzOffsetMinutes = now.getTimezoneOffset();
          
          console.log('📤 [SENDING TO AI FUNCTION]', {
            channelId: currentChannelId,
            ownerId: boardOwnerId,
            senderName,
            senderType,
            attachmentsCount: uploadedFiles.length
          });
          
          const { data, error } = await supabase.functions.invoke('ai-chat', {
            body: {
              channelId: currentChannelId,
              prompt: userMessage,
              ownerId: boardOwnerId,
              conversationHistory: conversationHistory,
              userTimezone: tz,
              tzOffsetMinutes,
              currentLocalTime: localTimeISO,
              attachments: uploadedFiles,
              senderName,
              senderType
            }
          });
          
          if (error) {
            console.error('❌ AI error:', error);
            toast({ 
              title: "AI Error", 
              description: error.message || 'Failed to get AI response', 
              variant: "destructive" 
            });
            return;
          }
          
          if (data?.success) {
            console.log('✅ AI response received and saved');
          }
        } catch (aiError) {
          console.error('❌ AI call failed:', aiError);
          toast({ 
            title: "AI Unavailable", 
            description: 'AI service is temporarily unavailable', 
            variant: "destructive" 
          });
        } finally {
          setIsSendingAI(false);
          if (onAISending) onAISending(false);
        }
      } else {
        // Handle normal message
        let uploadedFiles: any[] = [];
        if (attachments.length > 0) {
          for (const file of attachments) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage.from('chat_attachments').upload(filePath, file);
            if (uploadError) {
              console.error('Upload error:', uploadError);
              toast({ title: "Upload failed", description: `Could not upload ${file.name}`, variant: "destructive" });
              continue;
            }

            const { data: pub } = supabase.storage.from('chat_attachments').getPublicUrl(filePath);
            uploadedFiles.push({
              filename: file.name,
              file_path: filePath,
              content_type: file.type || undefined,
              size: file.size,
              public_url: pub.publicUrl,
              object_url: URL.createObjectURL(file),
            });
          }
        }
        onSendMessage(message.trim(), uploadedFiles);
        setMessage('');
        setAttachments([]);
      }
      
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMessage) {
      // For editing, only allow if there's content
      if (message.trim()) {
        await uploadAndSend();
      }
    } else {
      // For new messages, allow if there's content or attachments
      if (message.trim() || attachments.length > 0) {
        await uploadAndSend();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const validateAndCollect = (files: File[]) => {
    const valid: File[] = [];
    for (const file of files) {
      const okType = isAllowed(file);
      const okSize = file.size <= 50 * 1024 * 1024;
      if (!okType) {
        toast({ title: "Invalid file type", description: `${file.name} is not a supported file type`, variant: "destructive" });
        continue;
      }
      if (!okSize) {
        toast({ title: "File too large", description: `${file.name} exceeds 50MB limit`, variant: "destructive" });
        continue;
      }
      valid.push(file);
    }
    return valid;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = validateAndCollect(files);
    if (validFiles.length) setAttachments(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleEmojiSelect = (emoji: any) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentMessage = message;
      const newMessage = currentMessage.substring(0, start) + emoji.native + currentMessage.substring(end);
      setMessage(newMessage);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.native.length, start + emoji.native.length);
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const validFiles = validateAndCollect(files);
    if (validFiles.length) setAttachments(prev => [...prev, ...validFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // NEW: paste from clipboard (screenshots etc.)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items || []);
    const imageItems = items.filter(it => it.type.startsWith('image/'));
    if (!imageItems.length) return;
    const files = imageItems.map(it => it.getAsFile()).filter(Boolean) as File[];
    const validFiles = validateAndCollect(files);
    if (validFiles.length) {
      setAttachments(prev => [...prev, ...validFiles]);
    }
    // do not preventDefault so text still pastes if there was any
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  useEffect(() => { textareaRef.current?.focus(); }, []);
  
  // Set message content when editing
  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
    } else {
      setMessage('');
    }
  }, [editingMessage]);

  return (
    <div className="p-4">
      {/* AI Quick Prompts - show at top when in AI channel */}
      {isAIChannel && !editingMessage && !replyingTo && (
        <AIQuickPrompts onPromptSelect={(prompt) => setMessage(prompt)} />
      )}

      {/* Reply Context */}
      {replyingTo && (
        <div className="mb-2 p-2 bg-muted/50 rounded border-l-2 border-primary flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">
              Replying to <span className="font-medium">{replyingTo.sender_name}</span>
            </p>
            <p className="text-sm truncate">{replyingTo.content}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancelReply} className="h-6 w-6 p-0 ml-2">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Edit Context */}
      {editingMessage && (
        <div className="mb-2 p-2 bg-warning/10 rounded border-l-2 border-warning flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-warning mb-1 font-medium">
              Editing message
            </p>
            <p className="text-sm text-muted-foreground">Make your changes and press Enter to update</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancelEdit} className="h-6 w-6 p-0 ml-2">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* File attachments preview - hide when editing */}
      {attachments.length > 0 && !editingMessage && (
        <div className="mb-3 p-3 bg-muted/30 rounded-lg">
          <div className="text-sm text-muted-foreground mb-2">Attachments ({attachments.length})</div>
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-background rounded px-2 py-1 text-sm border max-w-[280px]">
                {iconForName(file.name, file.type)}
                <span className="truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(index)}
                  className="h-4 w-4 p-0 hover:text-destructive ml-auto"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1 relative" onDrop={handleDrop} onDragOver={handleDragOver}>
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={defaultPlaceholder}
            className="min-h-[60px] max-h-32 resize-none pr-20 py-3"
            rows={1}
            disabled={isUploading}
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.rtf,.xls,.xlsx,.csv,.ppt,.pptx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Input Actions */}
          <div className="absolute right-2 bottom-3 flex items-center gap-1">
            {!editingMessage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                disabled={isUploading}
                aria-label="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            )}

            {!editingMessage && (
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    disabled={isUploading}
                    onClick={() => setShowEmojiPicker(v => !v)}
                    aria-label="Insert emoji"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background border-input z-[10000]" align="end" side="top" sideOffset={8}>
                  <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="auto" previewPosition="none" skinTonePosition="none" />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <Button 
          type="submit" 
          size="sm" 
          disabled={
            editingMessage 
              ? !message.trim() || isUploading
              : (!message.trim() && attachments.length === 0) || isUploading
          } 
          className="h-12 w-12 p-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};