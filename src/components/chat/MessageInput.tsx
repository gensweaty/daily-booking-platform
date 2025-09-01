import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, X, FileText, Image as ImageIcon } from 'lucide-react';

// helper for size
const fmt = (n: number) => (n >= 1024*1024 ? `${(n/1024/1024).toFixed(1)} MB` : `${(n/1024).toFixed(0)} KB`);

const OFFICE_EXT = /\.(docx?|xlsx?|csv|pptx?)$/i;
const GOOGLE_SHORTCUT_EXT = /\.(gdoc|gsheet|gslides)$/i; // local shortcuts still uploadable
const isOfficeMime = (t: string) =>
  t.startsWith('application/vnd.openxmlformats-officedocument') ||
  t.startsWith('application/vnd.ms-') ||
  t.startsWith('application/vnd.ms') ||
  t.startsWith('application/vnd.google-apps');
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChatMessage } from '@/hooks/useChatMessages';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useToast } from '@/hooks/use-toast';

interface MessageInputProps {
  onSendMessage: (content: string, attachments?: any[]) => void;
  placeholder?: string;
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
}

export const MessageInput = ({ 
  onSendMessage, 
  placeholder,
  replyingTo,
  onCancelReply
}: MessageInputProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const defaultPlaceholder = placeholder || t('chat.typeMessage');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim() || attachments.length > 0) {
      setIsUploading(true);
      try {
        let uploadedFiles = [];
        
        if (attachments.length > 0) {
          for (const file of attachments) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('chat_attachments')
              .upload(filePath, file);

            if (uploadError) {
              console.error('Upload error:', uploadError);
              toast({
                title: "Upload failed",
                description: `Could not upload ${file.name}`,
                variant: "destructive",
              });
              continue;
            }

            const { data: pub } = supabase.storage
              .from('chat_attachments')
              .getPublicUrl(filePath);

            uploadedFiles.push({
              filename: file.name,
              file_path: filePath,
              content_type: file.type,
              size: file.size,
              public_url: pub.publicUrl,         // ⭐ used by optimistic UI
              object_url: URL.createObjectURL(file), // ⭐ ultra-fast preview
            });
          }
        }
        
        onSendMessage(message.trim(), uploadedFiles);
        setMessage('');
        setAttachments([]);
        
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } catch (error) {
        console.error('Error sending message:', error);
        toast({
          title: "Send failed",
          description: "Failed to send message with attachments",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(file => {
      const t = file.type || '';
      const name = file.name;

      const isImage = t.startsWith('image/');
      const isPdf = t === 'application/pdf' || /\.pdf$/i.test(name);
      const isOffice = isOfficeMime(t) || OFFICE_EXT.test(name);
      const isGoogleShortcut = GOOGLE_SHORTCUT_EXT.test(name);
      const okType = isImage || isPdf || isOffice || isGoogleShortcut || t === '' /* some browsers omit type */;

      const okSize = file.size <= 50 * 1024 * 1024;

      if (!okType) {
        toast({
          title: "Unsupported file",
          description: `${name} is not a supported type`,
          variant: "destructive",
        });
        return false;
      }
      if (!okSize) {
        toast({
          title: "File too large",
          description: `${name} exceeds the 50MB limit`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setAttachments(prev => [...prev, ...valid]);
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
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.native.length, start + emoji.native.length);
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    e.dataTransfer.clearData();

    const fakeEvt = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFileSelect(fakeEvt);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Auto focus
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  return (
    <div className="p-4">
      {/* Reply Context */}
      {replyingTo && (
        <div className="mb-2 p-2 bg-muted/50 rounded border-l-2 border-primary flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">
              Replying to <span className="font-medium">{replyingTo.sender_name}</span>
            </p>
            <p className="text-sm truncate">{replyingTo.content}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelReply}
            className="h-6 w-6 p-0 ml-2"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* File attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-3 p-3 bg-muted/30 rounded-lg">
          <div className="text-sm text-muted-foreground mb-2">
            Attachments ({attachments.length})
          </div>

          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => {
              const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
              return (
                <div
                  key={index}
                  className={
                    isImage
                      ? "relative overflow-hidden rounded-md border bg-background"
                      : "flex items-center gap-2 bg-background rounded px-2 py-1 text-sm border"
                  }
                >
                  {isImage ? (
                    <>
                      <img
                        src={URL.createObjectURL(file)}
                        onLoad={e => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                        alt={file.name}
                        className="h-16 w-24 object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white px-2 py-1 text-xs truncate">
                        {file.name} • {fmt(file.size)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="absolute top-1 right-1 h-6 w-6 p-0 bg-black/40 text-white hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* type-based chip */}
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-muted text-muted-foreground">
                        {OFFICE_EXT.test(file.name) || isOfficeMime(file.type) ? (
                          <FileText className="h-3.5 w-3.5" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="truncate max-w-40">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{fmt(file.size)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="h-4 w-4 p-0 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div 
          className="flex-1 relative"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
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
            accept="
    image/*,
    .pdf,
    .doc,.docx,.gdoc,
    .xls,.xlsx,.csv,.gsheet,
    .ppt,.pptx,.gslides
  "
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* Input Actions */}
          <div className="absolute right-2 bottom-3 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              disabled={isUploading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            
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
              
              <PopoverContent
                className="w-auto p-0 bg-background border-input z-[10000]"
                align="end"
                side="top"
                sideOffset={8}
              >
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="auto"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <Button
          type="submit"
          size="sm"
          disabled={(!message.trim() && attachments.length === 0) || isUploading}
          className="h-12 w-12 p-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};