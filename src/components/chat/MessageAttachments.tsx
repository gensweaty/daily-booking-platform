import { useState } from 'react';
import { FileText, Image as ImageIcon, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChatAttachment } from '@/hooks/useChatMessages';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MessageAttachmentsProps {
  attachments: ChatAttachment[];
}

export const MessageAttachments = ({ attachments }: MessageAttachmentsProps) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  const getFileIcon = (contentType?: string) => {
    if (contentType?.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${Math.round(bytes / 1024)}KB`;
    }
    return `${mb.toFixed(1)}MB`;
  };

  const handlePreview = async (attachment: ChatAttachment) => {
    if (!attachment.content_type?.startsWith('image/')) return;

    try {
      const { data } = supabase.storage
        .from('chat_attachments')
        .getPublicUrl(attachment.file_path);

      if (data?.publicUrl) {
        setPreviewImage(data.publicUrl);
        setPreviewOpen(true);
      }
    } catch (error) {
      console.error('Error getting preview URL:', error);
      toast({
        title: "Preview failed",
        description: "Could not load image preview",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (attachment: ChatAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('chat_attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download failed",
        description: "Could not download file",
        variant: "destructive",
      });
    }
  };

  if (!attachments.length) return null;

  return (
    <>
      <div className="mt-2 space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center gap-2 p-2 bg-muted/50 rounded border max-w-xs"
          >
            <div className="text-muted-foreground">
              {getFileIcon(attachment.content_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{attachment.filename}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(attachment.size)}
              </p>
            </div>
            <div className="flex gap-1">
              {attachment.content_type?.startsWith('image/') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePreview(attachment)}
                  className="h-6 w-6 p-0"
                  title="Preview"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(attachment)}
                className="h-6 w-6 p-0"
                title="Download"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex justify-center">
              <img
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};