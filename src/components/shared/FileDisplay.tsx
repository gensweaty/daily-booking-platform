// File display component handling both public and authenticated file access
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Download, ExternalLink, FileText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase, normalizeFilePath } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { FileRecord } from "@/types/files";
import { downloadFile, openFile } from "@/lib/api";

interface FileDisplayProps {
  files: FileRecord[];
  bucketName?: string;
  parentType?: string;
  parentId?: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
}

export const FileDisplay = ({
  files,
  bucketName = "event_attachments",
  parentType = "event",
  parentId,
  allowDelete = false,
  onFileDeleted,
}: FileDisplayProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  
  // Helper function to determine the correct bucket name for each file
  const getFileBucket = (file: FileRecord): string => {
    // If the file has a source property and it's 'booking', use booking_attachments
    if (file.source === 'booking') {
      return 'booking_attachments';
    }
    
    // If the path starts with 'booking_', use booking_attachments
    if (file.file_path && file.file_path.startsWith('booking_')) {
      return 'booking_attachments';
    }
    
    // Otherwise use the provided bucket name or default to event_attachments
    return bucketName || 'event_attachments';
  };

  const handleDelete = async (fileId: string, filePath: string, effectiveBucket: string) => {
    try {
      setIsDeleting(prev => ({ ...prev, [fileId]: true }));
      console.log(`Attempting to delete file: ${fileId}, path: ${filePath}, from bucket: ${effectiveBucket}`);
      
      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from(effectiveBucket)
        .remove([normalizeFilePath(filePath)]);
      
      if (storageError) {
        console.error("Error deleting file from storage:", storageError);
        throw storageError;
      }
      
      let deleteError = null;
      
      // Delete the database record based on parent type
      if (parentType === 'event') {
        const { error } = await supabase
          .from('event_files')
          .delete()
          .eq('id', fileId);
        deleteError = error;
      } else if (parentType === 'customer') {
        const { error } = await supabase
          .from('customer_files_new')
          .delete()
          .eq('id', fileId);
        deleteError = error;
      } else if (parentType === 'booking') {
        const { error } = await supabase
          .from('booking_files')
          .delete()
          .eq('id', fileId);
        deleteError = error;
      }
      
      if (deleteError) {
        console.error(`Error deleting ${parentType} file record:`, deleteError);
        throw deleteError;
      }
      
      // Notify parent component
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
      });
      
    } catch (error) {
      console.error("Error in handleDelete:", error);
      toast({
        title: t("common.error"),
        description: t("common.fileDeleteError"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const handleDownload = async (file: FileRecord) => {
    const effectiveBucket = getFileBucket(file);
    console.log(`Downloading file from bucket: ${effectiveBucket}, path: ${file.file_path}`);
    
    try {
      await downloadFile(effectiveBucket, file.file_path, file.filename);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: t("common.error"),
        description: t("common.fileDownloadError"),
        variant: "destructive",
      });
    }
  };

  const handleOpenFile = async (file: FileRecord) => {
    const effectiveBucket = getFileBucket(file);
    console.log(`Opening file from bucket: ${effectiveBucket}, path: ${file.file_path}`);
    
    try {
      await openFile(effectiveBucket, file.file_path);
    } catch (error) {
      console.error("Error opening file:", error);
      toast({
        title: t("common.error"),
        description: t("common.fileOpenError"),
        variant: "destructive",
      });
    }
  };

  const getFileExt = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };
  
  const getFileIcon = (filename: string) => {
    const ext = getFileExt(filename);
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <FileText className="h-4 w-4" />;
    }
    
    if (['pdf'].includes(ext)) {
      return <FileText className="h-4 w-4" />;
    }
    
    if (['doc', 'docx'].includes(ext)) {
      return <FileText className="h-4 w-4" />;
    }
    
    if (['xls', 'xlsx'].includes(ext)) {
      return <FileText className="h-4 w-4" />;
    }
    
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="text-sm font-medium text-gray-700">{t("common.attachedFiles")}:</div>
      {files.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("common.noFiles")}</div>
      ) : (
        <div className="space-y-2">
          {files.map(file => {
            const effectiveBucket = getFileBucket(file);
            
            return (
              <div key={file.id} className="flex items-center justify-between border rounded-md p-2 bg-background">
                <div className="flex items-center space-x-2 overflow-hidden">
                  {getFileIcon(file.filename)}
                  <span className="text-sm truncate">{file.filename}</span>
                </div>
                <div className="flex space-x-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenFile(file)}
                    title={t("common.openFile")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(file)}
                    title={t("common.downloadFile")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {allowDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(file.id, file.file_path, effectiveBucket)}
                      disabled={isDeleting[file.id]}
                      title={t("common.deleteFile")}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
