
import { useState } from "react";
import { File, FileText, FileSpreadsheet, Image, Music, Video, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { getStorageUrl, normalizeFilePath } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { LanguageText } from "@/components/shared/LanguageText";

interface FileDisplayProps {
  files?: any[];
  bucketName?: string;
  onFileDeleted?: (fileId: string) => void;
  allowDelete?: boolean;
  parentType?: "event" | "customer" | "note" | "task" | "booking_request";
  parentId?: string;
  showDelete?: boolean;
}

export const FileDisplay = ({ 
  files, 
  bucketName, 
  onFileDeleted, 
  allowDelete = true, 
  parentType = "event", 
  parentId,
  showDelete = true 
}: FileDisplayProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isGeorgian = language === 'ka';
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Default bucket name if not provided based on parent type
  const determineBucketName = (parentType: string): string => {
    switch (parentType.toLowerCase()) {
      case 'event':
        return 'event_attachments';
      case 'customer':
        return 'customer_attachments';
      case 'note':
        return 'note_attachments';
      case 'task':
        return 'task_attachments';
      case 'booking_request':
        return 'event_attachments'; // Booking requests use event_attachments bucket
      default:
        return 'event_attachments';
    }
  };

  const effectiveBucketName = bucketName || determineBucketName(parentType);

  // Generate public URL for file using our helper functions
  const getPublicUrl = (filePath: string): string => {
    if (!filePath) return '';

    // Normalize the file path (remove any leading slashes) using our helper
    const normalizedPath = normalizeFilePath(filePath);
    
    // Construct a direct storage URL using the helper function
    return `${getStorageUrl()}/object/public/${effectiveBucketName}/${normalizedPath}`;
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      setDeletingId(fileId);
      
      // Determine if we're deleting from a specific table based on parent type
      let deleteSuccess = false;
      const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      
      // First try to delete the file record from the database
      if (parentType === 'event' || parentType === 'booking_request') {
        const { error: deleteRecordError } = await supabase
          .from('event_files')
          .delete()
          .eq('id', fileId);
          
        if (deleteRecordError) {
          console.error("Error deleting event file record:", deleteRecordError);
        } else {
          deleteSuccess = true;
        }
      } else if (parentType === 'customer') {
        const { error: deleteRecordError } = await supabase
          .from('customer_files_new')
          .delete()
          .eq('id', fileId);
          
        if (deleteRecordError) {
          console.error("Error deleting customer file record:", deleteRecordError);
        } else {
          deleteSuccess = true;
        }
      } else if (parentType === 'note') {
        const { error: deleteRecordError } = await supabase
          .from('note_files')
          .delete()
          .eq('id', fileId);
          
        if (deleteRecordError) {
          console.error("Error deleting note file record:", deleteRecordError);
        } else {
          deleteSuccess = true;
        }
      } else if (parentType === 'task') {
        const { error: deleteRecordError } = await supabase
          .from('files')
          .delete()
          .eq('id', fileId);
          
        if (deleteRecordError) {
          console.error("Error deleting task file record:", deleteRecordError);
        } else {
          deleteSuccess = true;
        }
      }
      
      // Try to delete the actual file from storage
      // Note: This may fail if the file is already gone, and that's OK
      try {
        const { error: storageError } = await supabase.storage
          .from(effectiveBucketName)
          .remove([normalizedPath]);
          
        if (storageError) {
          console.warn("Warning: Could not delete file from storage:", storageError);
          // This is just a warning, not a failure, as the record is more important
        }
      } catch (storageErr) {
        console.warn("Exception trying to delete from storage:", storageErr);
        // Continue despite storage error - the database record is more important
      }
      
      // If we deleted the record successfully, trigger the callback
      if (deleteSuccess && onFileDeleted) {
        onFileDeleted(fileId);
        toast({
          title: t('common.success'),
          description: t('common.fileDeleted'),
        });
      } else if (!deleteSuccess) {
        toast({
          title: t('common.warning'),
          description: t('common.fileDeleteFailed'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in handleDelete:", error);
      toast({
        title: t('common.error'),
        description: t('common.fileDeleteFailed'),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Determine file icon based on mimetype or extension
  const getFileIcon = (file: any) => {
    const contentType = file.content_type || '';
    const filename = file.filename || '';
    
    // Check content type first (more reliable)
    if (contentType.includes('image/')) {
      return <Image className="h-5 w-5" />;
    } else if (contentType.includes('application/pdf')) {
      return <FileText className="h-5 w-5" />;
    } else if (contentType.includes('text/')) {
      return <FileText className="h-5 w-5" />;
    } else if (contentType.includes('audio/')) {
      return <Music className="h-5 w-5" />;
    } else if (contentType.includes('video/')) {
      return <Video className="h-5 w-5" />;
    }
    
    // Fall back to checking file extension
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <Image className="h-5 w-5" />;
    } else if (ext === 'pdf') {
      return <FileText className="h-5 w-5" />;
    } else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
      return <FileText className="h-5 w-5" />;
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="h-5 w-5" />;
    } else {
      return <File className="h-5 w-5" />;
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number | null | undefined) => {
    if (bytes == null) return 'Unknown size';
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadFile = async (file: any) => {
    try {
      const filePath = file.file_path;
      if (!filePath) {
        console.error("No file path provided for download");
        return;
      }

      const publicUrl = getPublicUrl(filePath);
      console.log("Downloading file from URL:", publicUrl);
      
      // Create a temporary anchor and trigger download
      const link = document.createElement('a');
      link.href = publicUrl;
      link.setAttribute('download', file.filename || 'download');
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: t('common.error'),
        description: t('common.downloadFailed'),
        variant: "destructive",
      });
    }
  };

  // Render an empty state if no files
  if (!files || files.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        <LanguageText>{t('common.noFiles')}</LanguageText>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        <LanguageText>{t('common.files')}</LanguageText> ({files.length})
      </div>
      <div className="grid gap-2">
        {files.map((file) => (
          <div 
            key={file.id} 
            className="flex items-center justify-between p-2 bg-muted/50 rounded-md group"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => downloadFile(file)}>
              <div className="flex-shrink-0">
                {getFileIcon(file)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" title={file.filename || 'Unnamed file'}>
                  {file.filename || 'Unnamed file'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </div>
              </div>
            </div>
            
            {showDelete && allowDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(file.id, file.file_path);
                }}
                disabled={deletingId === file.id}
              >
                {deletingId === file.id ? (
                  <Spinner size="sm" />
                ) : (
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
