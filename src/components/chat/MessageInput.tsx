import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, X, FileText, Image as ImageIcon, FileSpreadsheet, Presentation, Mic, Square, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ChatMessage } from '@/hooks/useChatMessages';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useToast } from '@/hooks/use-toast';
import { AIQuickPrompts } from './AIQuickPrompts';
import { useASR } from '@/hooks/useASR';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
  onTranscribing?: (isTranscribing: boolean) => void;
}

const ALLOWED_MIME: Record<string, string[]> = {
  image: ['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/bmp','image/svg+xml'],
  pdf: ['application/pdf'],
  word: ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/rtf'],
  excel: ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'],
  ppt: ['application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  audio: ['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/aac','audio/wav'],
};

const isAllowed = (file: File) => {
  const t = (file.type || '').toLowerCase();
  if (Object.values(ALLOWED_MIME).some(list => list.includes(t))) return true;
  // fallback by extension (covers some browsers that give generic types)
  const n = file.name.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|pdf|docx?|rtf|xlsx?|csv|pptx?|webm|ogg|mp3|m4a|aac|wav)$/.test(n);
};

const iconForName = (name: string, type: string) => {
  const n = name.toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n)) return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
  if (type.startsWith('audio/') || /\.(webm|ogg|mp3|m4a|aac|wav)$/i.test(n)) return <Music className="h-4 w-4 text-muted-foreground" />;
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
  onAISending,
  onTranscribing
}: MessageInputProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [message, setMessage] = useState('');
  const messageRef = useRef('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingAI, setIsSendingAI] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice recording state (for non-AI channels)
  const [voiceRecState, setVoiceRecState] = useState<'idle'|'recording'|'stopped'|'uploading'>('idle');
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const voiceMediaRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<number | null>(null);
  
  // Quick prompts state with localStorage persistence
  // Only show on very first time (first login + first chat open)
  const [showQuickPrompts, setShowQuickPrompts] = useState(() => {
    if (!isAIChannel) return false;
    const hasSeenKey = `ai-quick-prompts-seen-${boardOwnerId || 'default'}`;
    const hasSeen = localStorage.getItem(hasSeenKey);
    return hasSeen !== 'true'; // Show only if never seen before
  });
  
  // Mark as seen when component mounts with quick prompts visible
  useEffect(() => {
    if (isAIChannel && showQuickPrompts) {
      const hasSeenKey = `ai-quick-prompts-seen-${boardOwnerId || 'default'}`;
      // Don't mark as seen immediately - let user see it first
      // Will be marked as seen when they first interact (send message or close manually)
    }
  }, [isAIChannel, showQuickPrompts, boardOwnerId]);
  
  // Voice recording hook (only for AI channels)
  const { start: startRecording, stop: stopRecording, transcribe, status: asrStatus, seconds } = useASR();
  const isRecording = asrStatus === 'recording';
  const isTranscribing = asrStatus === 'transcribing';
  
  // Notify parent about transcription status (only for non-AI channels)
  // AI channels handle typing state in handleStopAndSend
  useEffect(() => {
    if (onTranscribing && !isAIChannel) {
      onTranscribing(isTranscribing);
    }
  }, [isTranscribing, onTranscribing, isAIChannel]);
  
  const defaultPlaceholder = placeholder || t('chat.typeMessage');

  const uploadAndSend = async () => {
    setIsUploading(true);
    // Use messageRef for immediate value, fallback to state
    const messageToSend = messageRef.current || message;
    
    try {
      if (editingMessage) {
        // Handle editing
        if (onEditMessage && messageToSend.trim()) {
          await onEditMessage(editingMessage.id, messageToSend.trim());
          setMessage('');
          messageRef.current = '';
          if (onCancelEdit) onCancelEdit();
        }
      } else if (isAIChannel && currentChannelId && boardOwnerId) {
        // Handle AI channel message with file support
        console.log('🤖 Sending message to AI channel with attachments:', attachments.length);
        
        // MOBILE OPTIMIZATION: Display user message IMMEDIATELY (optimistic paint)
        // before doing any heavy processing, so UI feels instant
        const userMessage = messageToSend.trim();
        
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
        
        // ⚡ CRITICAL: Send user message NOW for immediate UI feedback (especially on mobile)
        // This triggers optimistic paint in ChatArea, so user sees their message instantly
        console.log('🤖 Displaying user message immediately (optimistic paint)');
        onSendMessage(userMessage, uploadedFiles);
        setMessage('');
        messageRef.current = '';
        setAttachments([]);
        
        // Get current user info with proper name resolution
        const { data: { user } } = await supabase.auth.getUser();
        let senderName = 'User';
        let senderType: 'admin' | 'sub_user' = 'admin';
        let effectiveBoardOwnerId = boardOwnerId;

        // 1) Public board visitor identity - FIX: correct route check
        const isOnPublicBoard = window.location.pathname.startsWith('/board/');
        const publicBoardSlug = isOnPublicBoard ? window.location.pathname.split('/').pop() : null;

        if (isOnPublicBoard && publicBoardSlug) {
          // First, get the actual board owner ID from public_boards
          const { data: publicBoard } = await supabase
            .from('public_boards')
            .select('user_id')
            .eq('slug', publicBoardSlug)
            .maybeSingle();
          
          if (publicBoard) {
            effectiveBoardOwnerId = publicBoard.user_id;
          }

          // Then resolve sub-user from localStorage
          const stored = JSON.parse(localStorage.getItem(`public-board-access-${publicBoardSlug}`) || '{}');
          if (stored.email && effectiveBoardOwnerId) {
            const { data: subUser } = await supabase
              .from('sub_users')
              .select('id, fullname, email')
              .eq('board_owner_id', effectiveBoardOwnerId)
              .ilike('email', stored.email)
              .maybeSingle();

            if (subUser) {
              senderName = subUser.fullname || stored.fullName || stored.email.split('@')[0];
              senderType = 'sub_user';
              
              console.log('🔍 AI Request Context:', {
                isOnPublicBoard,
                publicBoardSlug,
                effectiveBoardOwnerId,
                senderName,
                senderType,
                subUserId: subUser.id
              });
            }
          }
        }
        // 2) Authenticated sub-user session (NEW: trust auth metadata first)
        else if (user?.user_metadata?.role === 'sub_user') {
          senderType = 'sub_user';
          senderName =
            (user.user_metadata.full_name as string) ||
            (user.user_metadata.username as string) ||
            (user.email?.split('@')[0] ?? 'User');
        }
        // 3) Authenticated admin/owner (fallbacks kept as-is)
        else if (user) {
          // Try to match an existing sub_user by email (covers legacy setups)
          const { data: subUser } = await supabase
            .from('sub_users')
            .select('fullname, email, board_owner_id')
            .eq('board_owner_id', effectiveBoardOwnerId) // Use effective board owner ID
            .ilike('email', user.email ?? '')
            .maybeSingle();

          if (subUser?.fullname) {
            senderName = subUser.fullname;
            senderType = 'sub_user';
          } else {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', user.id)
              .maybeSingle();

            // Use profile username only if it's not an auto-generated "user_..."
            if (profile?.username && !profile.username.startsWith('user_')) {
              senderName = profile.username;
            } else {
              senderName = user.email?.split('@')[0] || 'User';
            }
            senderType = 'admin';
          }
        }
        
        // Get recent conversation history (last 20 messages)
        const { data: recentMessages } = await supabase
          .from('chat_messages')
          .select('sender_type, content')
          .eq('channel_id', currentChannelId)
          .eq('owner_id', effectiveBoardOwnerId) // Use effective board owner ID
          .order('created_at', { ascending: false })
          .limit(20);

        const conversationHistory = (recentMessages || [])
          .reverse()
          .map(msg => ({
            role: msg.sender_type === 'system' ? 'assistant' : 'user',
            content: msg.content
          }));
        
        // For AI channels, ensure typing indicator stays on throughout entire process
        // Don't reset state if already in sending mode (from voice)
        if (!isSendingAI) {
          // Mark quick prompts as seen when user sends first message
          const hasSeenKey = `ai-quick-prompts-seen-${boardOwnerId || 'default'}`;
          localStorage.setItem(hasSeenKey, 'true');
          setShowQuickPrompts(false); // Close quick suggestions only on new send
          setIsSendingAI(true);
          if (onAISending) {
            console.log('🤖 Setting AI typing indicator ON (text message)');
            onAISending(true);
          }
        } else {
          console.log('🤖 Already in sending mode (voice), maintaining typing indicator');
        }
        
        // Call AI edge function (it will insert the AI response)
        try {
          // Get current local time from browser
          const now = new Date();
          const localTimeISO = now.toISOString();
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const tzOffsetMinutes = now.getTimezoneOffset();
          
          const { data, error } = await supabase.functions.invoke('ai-chat', {
            body: {
              channelId: currentChannelId,
              prompt: userMessage,
              ownerId: effectiveBoardOwnerId, // Use the corrected board owner ID
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
          } else if (data?.error) {
            console.error('❌ AI returned error:', data.error);
            toast({ 
              title: "AI Error", 
              description: data.error, 
              variant: "destructive" 
            });
          }
        } catch (aiError) {
          console.error('❌ AI call failed:', aiError);
          toast({ 
            title: "AI Unavailable", 
            description: 'AI service is temporarily unavailable', 
            variant: "destructive" 
          });
        } finally {
          console.log('🤖 AI response complete, turning OFF typing indicator');
          
          // Mobile optimization: Delay state reset to ensure smooth UI transition
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          const delay = isMobile ? 150 : 50;
          
          setTimeout(() => {
            setIsSendingAI(false);
            if (onAISending) {
              onAISending(false);
              console.log('🤖 Typing indicator turned OFF');
            }
          }, delay);
          
          // Keep quick prompts closed - user will reopen manually if needed
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
        onSendMessage(messageToSend.trim(), uploadedFiles);
        setMessage('');
        messageRef.current = '';
        setAttachments([]);
        // Don't auto-reopen quick prompts for any channel - user controls visibility
        setShowQuickPrompts(false);
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
      const okSize = file.size <= 5 * 1024 * 1024; // 5MB limit
      if (!okType) {
        toast({ title: "Invalid file type", description: `${file.name} is not a supported file type`, variant: "destructive" });
        continue;
      }
      if (!okSize) {
        toast({ title: "File too large", description: `${file.name} exceeds 5MB limit`, variant: "destructive" });
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
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length > 0) {
      e.preventDefault();
      imageItems.forEach(item => {
        const file = item.getAsFile();
        if (file) {
          const valid = validateAndCollect([file]);
          setAttachments(prev => [...prev, ...valid]);
        }
      });
    }
  };

  // Voice recording functions (only for non-AI channels)
  const startVoiceRecording = async () => {
    if (voiceRecState !== 'idle') return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      const recorder = new MediaRecorder(stream, { 
        mimeType: mimeType || undefined, 
        audioBitsPerSecond: 24000
      });
      
      voiceMediaRef.current = recorder;
      voiceChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
      };
      
      setVoiceSeconds(0);
      setVoiceRecState('recording');
      recorder.start();
      
      voiceTimerRef.current = window.setInterval(() => {
        setVoiceSeconds(s => {
          const next = s + 1;
          if (next >= 60) stopVoiceRecording();
          return next;
        });
      }, 1000) as unknown as number;
      
      console.log('🎤 Voice recording started:', mimeType);
    } catch (error) {
      console.error('❌ Microphone access denied:', error);
      toast({ 
        title: "Microphone Access Denied", 
        description: "Please allow microphone access to record voice messages.",
        variant: "destructive" 
      });
    }
  };

  const stopVoiceRecording = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (voiceMediaRef.current?.state === 'recording') {
      voiceMediaRef.current.stop();
    }
    setVoiceRecState('stopped');
    console.log('🎤 Voice recording stopped:', voiceSeconds, 'seconds');
  };

  const cancelVoiceRecording = () => {
    stopVoiceRecording();
    voiceChunksRef.current = [];
    setVoiceRecState('idle');
    setVoiceSeconds(0);
    console.log('🎤 Voice recording canceled');
  };

  const sendVoiceMessage = async () => {
    if (!voiceChunksRef.current.length) {
      setVoiceRecState('idle');
      return;
    }
    
    setVoiceRecState('uploading');
    
    try {
      const blob = new Blob(voiceChunksRef.current, { 
        type: voiceChunksRef.current[0]?.type || 'audio/webm' 
      });
      
      let ext = 'webm';
      if (blob.type.includes('ogg')) ext = 'ogg';
      else if (blob.type.includes('mp4')) ext = 'm4a';
      else if (blob.type.includes('mpeg')) ext = 'mp3';
      
      const fileName = `voice-${Date.now()}.${ext}`;
      const filePath = fileName;
      
      console.log('📤 Uploading voice message:', fileName, 'Size:', blob.size, 'Duration:', voiceSeconds);
      
      const { error: uploadError } = await supabase.storage
        .from('chat_attachments')
        .upload(filePath, blob);
        
      if (uploadError) {
        console.error('❌ Voice upload failed:', uploadError);
        toast({ 
          title: "Upload Failed", 
          description: "Could not upload voice message", 
          variant: "destructive" 
        });
        setVoiceRecState('idle');
        return;
      }
      
      const { data: pub } = supabase.storage
        .from('chat_attachments')
        .getPublicUrl(filePath);
        
      const voiceAttachment = {
        filename: fileName,
        file_path: filePath,
        content_type: blob.type,
        size: blob.size,
        public_url: pub.publicUrl,
        meta: { duration: voiceSeconds }
      };
      
      await onSendMessage('', [voiceAttachment]);
      
      voiceChunksRef.current = [];
      setVoiceRecState('idle');
      setVoiceSeconds(0);
      
      console.log('✅ Voice message sent successfully');
    } catch (error) {
      console.error('❌ Error sending voice message:', error);
      toast({ 
        title: "Send Failed", 
        description: "Could not send voice message", 
        variant: "destructive" 
      });
      setVoiceRecState('idle');
    }
  };

  // Handle AI channel voice recording stop and transcription
  const handleStopAndSend = async () => {
    console.log('🎤 Stopping AI voice recording and transcribing...');
    
    // Stop the ASR recording
    await stopRecording();
    
    try {
      // Turn on typing indicator before transcription starts
      if (onAISending) {
        onAISending(true);
      }
      setIsSendingAI(true);
      
      // Transcribe the audio
      const result = await transcribe();
      
      if (result.text) {
        console.log('✅ Transcription complete:', result.text);
        // Set the message and trigger send
        setMessage(result.text);
        messageRef.current = result.text;
        
        // Send the transcribed text (will be handled by uploadAndSend for AI channels)
        setTimeout(() => uploadAndSend(), 100);
      } else {
        console.log('❌ No transcription result');
        if (onAISending) {
          onAISending(false);
        }
        setIsSendingAI(false);
      }
    } catch (error) {
      console.error('❌ Transcription error:', error);
      toast({
        title: "Transcription Failed",
        description: error instanceof Error ? error.message : "Could not transcribe voice message",
        variant: "destructive"
      });
      if (onAISending) {
        onAISending(false);
      }
      setIsSendingAI(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  useEffect(() => { textareaRef.current?.focus(); }, []);
  
  // Cleanup voice recording on unmount
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      if (voiceMediaRef.current?.state === 'recording') {
        voiceMediaRef.current.stop();
      }
    };
  }, []);
  
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
      {/* AI Quick Prompts - always visible in AI channels but collapsed by default */}
      {isAIChannel && !editingMessage && !replyingTo && (
        <AIQuickPrompts 
          initiallyExpanded={false}
          onExpandedChange={(expanded) => {
            // Track state but don't hide the component
            setShowQuickPrompts(expanded);
          }}
          onPromptSelect={(prompt) => {
            setMessage(prompt);
            setShowQuickPrompts(false); // Collapse after selecting
          }} 
        />
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

      {/* Voice recording status */}
      {isRecording && (
        <div className="mb-2 p-2 bg-destructive/10 rounded border-l-2 border-destructive flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs text-muted-foreground">
              Recording… {seconds}s / 60s max
            </span>
          </div>
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
            onChange={(e) => {
              setMessage(e.target.value);
              messageRef.current = e.target.value;
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isTranscribing ? "Transcribing voice..." : defaultPlaceholder}
            className="min-h-[60px] max-h-32 resize-none pr-20 py-3"
            rows={1}
            disabled={isUploading || isTranscribing}
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
          <div className="absolute right-2 bottom-3 flex items-center gap-0.5">
            {!editingMessage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                disabled={isUploading}
                aria-label="Attach files"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            )}

            {!editingMessage && (
              <>
                {isMobile ? (
                  <Sheet open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <SheetTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                        disabled={isUploading}
                        aria-label="Insert emoji"
                      >
                        <Smile className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent 
                      side="bottom" 
                      className="h-[400px] p-0 border-t"
                    >
                      <div className="flex items-center justify-center h-full">
                        <Picker 
                          data={data} 
                          onEmojiSelect={(emoji: any) => {
                            handleEmojiSelect(emoji);
                            setShowEmojiPicker(false);
                          }} 
                          theme="auto" 
                          previewPosition="none" 
                          skinTonePosition="none" 
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                ) : (
                  <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                        disabled={isUploading}
                        aria-label="Insert emoji"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowEmojiPicker(!showEmojiPicker);
                        }}
                      >
                        <Smile className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-auto p-0 bg-background border-input" 
                      align="end" 
                      side="top" 
                      sideOffset={8}
                    >
                      <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="auto" previewPosition="none" skinTonePosition="none" />
                    </PopoverContent>
                  </Popover>
                )}
              </>
            )}

            {/* Voice recording button - only for AI channels */}
            {!editingMessage && isAIChannel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-500/10"
                disabled={isUploading || isTranscribing}
                onClick={() => isRecording ? handleStopAndSend() : startRecording()}
                aria-label={isRecording ? "Stop recording" : "Record voice"}
                title={isRecording ? "Stop recording and send" : "Record voice message (max 60s)"}
              >
                {isRecording ? <Square className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
              </Button>
            )}

            {/* Voice Message Button - Only for DMs/Custom Chats (NOT AI channels) */}
            {!editingMessage && !isAIChannel && voiceRecState === 'idle' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-500/10"
                onClick={startVoiceRecording}
                title="Record voice message (max 60s)"
                aria-label="Record voice message"
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}

            {/* Voice Recording Active */}
            {!editingMessage && !isAIChannel && voiceRecState === 'recording' && (
              <div className="flex items-center gap-2 px-2 py-1 bg-destructive/10 rounded-md">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={stopVoiceRecording}
                  title="Stop recording"
                >
                  <Square className="h-4 w-4 text-destructive fill-destructive" />
                </Button>
                <span className="text-sm font-mono text-destructive">
                  {Math.floor(voiceSeconds / 60)}:{(voiceSeconds % 60).toString().padStart(2, '0')}
                </span>
                {voiceSeconds >= 55 && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    {60 - voiceSeconds}s left
                  </span>
                )}
              </div>
            )}

            {/* Voice Recording Stopped */}
            {!editingMessage && !isAIChannel && voiceRecState === 'stopped' && (
              <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={cancelVoiceRecording}
                  title="Cancel voice message"
                >
                  <X className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  Voice ({voiceSeconds}s)
                </span>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={sendVoiceMessage}
                  title="Send voice message"
                >
                  Send
                </Button>
              </div>
            )}

            {/* Voice Recording Uploading */}
            {!editingMessage && !isAIChannel && voiceRecState === 'uploading' && (
              <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
                <span className="text-sm font-medium">
                  Sending voice...
                </span>
              </div>
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