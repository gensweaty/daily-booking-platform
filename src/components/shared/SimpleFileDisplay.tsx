
import { Button } from "@/components/ui/button";
import { supabase, getStorageUrl, normalizeFilePath } from "@/integrations/supabase/client";
import { Download, Trash2, FileIcon, ExternalLink, FileText, FileSpreadsheet, PresentationIcon } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FileRecord } from "@/types/files";

interface SimpleFileDisplayProps {
  files: FileRecord[];
  parentType: 'task' | 'event' | 'customer' | 'note';
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentId?: string;
}

export const SimpleFileDisplay = ({ 
  files, 
  parentType,
  allowDelete = false, 
  onFileDeleted,
  parentId
}: SimpleFileDisplayProps) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Simple bucket mapping based on parent type
  const getBucketName = (type: string): string => {
    switch (type) {
      case 'task': return 'task_attachments';
      case 'event': return 'event_attachments';
      case 'customer': return 'customer_attachments';
      case 'note': return 'event_attachments'; // Notes use event_attachments for now
      default: return 'event_attachments';
    }
  };

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };
  
  const isImage = (filename: string): boolean => {
    const ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  };

  const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename);
    
    if (['pdf', 'doc', 'docx'].includes(ext)) {
      return <FileText className="h-5 w-5" />;
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="h-5 w-5" />;
    } else if (['ppt', 'pptx'].includes(ext)) {
      return <PresentationIcon className="h-5 w-5" />;
    }
    
    return <FileIcon className="h-5 w-5" />;
  };

  const generateSignedUrl = async (bucketName: string, filePath: string): Promise<string | null> => {
    try {
      const normalizedPath = normalizeFilePath(filePath);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(normalizedPath, 300);
      
      if (error || !data) {
        console.error(`Error generating signed URL for ${bucketName}:${normalizedPath}`, error);
        return null;
      }
      
      return data.signedUrl;
    } catch (error) {
      console.error(`Error in generateSignedUrl:`, error);
      return null;
    }
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      const bucketName = getBucketName(parentType);
      const signedUrl = await generateSignedUrl(bucketName, file.file_path);
      
      if (!signedUrl) {
        throw new Error("Failed to generate download URL");
      }
      
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
      toast({
        title: t("common.success"),
        description: t("common.downloadStarted"),
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: t("common.error"),
        description: t("common.downloadError"),
        variant: "destructive",
      });
    }
  };

  const handleOpenFile = async (file: FileRecord) => {
    try {
      const bucketName = getBucketName(parentType);
      const signedUrl = await generateSignedUrl(bucketName, file.file_path);
      
      if (!signedUrl) {
        throw new Error("Failed to generate file URL");
      }
      
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Open file error:', error);
      toast({
        title: t("common.error"),
        description: t("common.fileAccessError"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (file: FileRecord) => {
    try {
      setDeletingFileId(file.id);
      
      const bucketName = getBucketName(parentType);
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([normalizeFilePath(file.file_path)]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        throw storageError;
      }
      
      // Delete from database using type-safe table references
      let dbError;
      
      if (parentType === 'task') {
        const { error } = await supabase
          .from('files')
          .delete()
          .eq('id', file.id);
        dbError = error;
      } else if (parentType === 'event') {
        const { error } = await supabase
          .from('event_files')
          .delete()
          .eq('id', file.id);
        dbError = error;
      } else if (parentType === 'customer') {
        const { error } = await supabase
          .from('customer_files_new')
          .delete()
          .eq('id', file.id);
        dbError = error;
      } else if (parentType === 'note') {
        const { error } = await supabase
          .from('note_files')
          .delete()
          .eq('id', file.id);
        dbError = error;
      }
        
      if (dbError) {
        console.error(`Database deletion error for ${parentType}:`, dbError);
        throw dbError;
      }
      
      if (onFileDeleted) {
        onFileDeleted(file.id);
      }
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: t("common.error"),
        description: t("common.deleteError"),
        variant: "destructive",
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {files.map((file) => {
        if (!file.file_path) return null;
        
        const fileNameDisplay = file.filename && file.filename.length > 20 
          ? file.filename.substring(0, 20) + '...' 
          : file.filename;
          
        return (
          <div key={file.id} className="flex flex-col bg-background border rounded-md overflow-hidden">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-hidden">
                {isImage(file.filename) ? (
                  <div className="h-8 w-8 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                    <img 
                      src={`${getStorageUrl()}/object/public/${getBucketName(parentType)}/${normalizeFilePath(file.file_path)}`}
                      alt={file.filename}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        console.error('Image failed to load');
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center">
                    {getFileIcon(file.filename)}
                  </div>
                )}
                <span className="truncate text-sm">{fileNameDisplay}</span>
              </div>
              <div className="flex space-x-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(file)}
                  title={t("common.download")}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {allowDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(file)}
                    disabled={deletingFileId === file.id}
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none border-t flex items-center justify-center gap-2 py-1.5"
              onClick={() => handleOpenFile(file)}
            >
              <ExternalLink className="h-4 w-4" />
              {t("crm.open")}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
