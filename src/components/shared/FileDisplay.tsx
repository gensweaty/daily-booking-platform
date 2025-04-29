import { FileRecord } from "@/types/files";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Download } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface FileDisplayProps {
  file?: FileRecord;
  files?: FileRecord[];
  onDelete?: (id: string) => void;
  onFileDeleted?: (fileId: string) => void;
  showDelete?: boolean;
  allowDelete?: boolean;
  parentType?: string;
  // For backward compatibility with other components
  bucketName?: string;
  parentId?: string;
}

export const FileDisplay = ({
  file,
  files,
  onDelete,
  onFileDeleted,
  showDelete = true,
  allowDelete = false,
  parentType = 'event',
  bucketName,
  parentId
}: FileDisplayProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  
  // Support both legacy and new properties
  const effectiveShowDelete = showDelete || allowDelete;
  const effectiveOnDelete = onDelete || onFileDeleted;
  
  // Get the appropriate bucket name based on the file source or parent type
  const getBucketName = () => {
    // If bucketName is provided directly, use that
    if (bucketName) return bucketName;
    
    // Otherwise determine from parentType
    switch (parentType) {
      case 'task':
        return 'task_attachments';
      case 'note':
        return 'note_attachments';
      case 'customer':
        return 'customer_attachments';
      case 'event':
      default:
        return 'event_attachments';
    }
  };
  
  const handleDelete = async (fileToDelete: FileRecord) => {
    if (!fileToDelete.id) return;
    
    try {
      setIsDeleting(true);
      
      // Step 1: Delete the file from storage if it has a path
      if (fileToDelete.file_path) {
        const bucket = getBucketName();
        console.log(`Attempting to delete file from ${bucket}/${fileToDelete.file_path}`);
        
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([fileToDelete.file_path]);
          
        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
          // Continue even if storage delete fails - we still want to remove the record
        }
      }
      
      // Step 2: Delete the file record from the database
      let error;
      
      // Determine which table to delete from based on parentType
      if (fileToDelete.source === 'event_files' || parentType === 'event') {
        const { error: dbError } = await supabase
          .from('event_files')
          .delete()
          .eq('id', fileToDelete.id);
          
        error = dbError;
      } else if (parentType === 'customer' || fileToDelete.customer_id) {
        const { error: dbError } = await supabase
          .from('customer_files_new')
          .delete()
          .eq('id', fileToDelete.id);
          
        error = dbError;
      } else if (parentType === 'note') {
        const { error: dbError } = await supabase
          .from('note_files')
          .delete()
          .eq('id', fileToDelete.id);
          
        error = dbError;
      } else if (parentType === 'task') {
        const { error: dbError } = await supabase
          .from('files')
          .delete()
          .eq('id', fileToDelete.id);
          
        error = dbError;
      }
      
      if (error) {
        console.error('Error deleting file record:', error);
        throw error;
      }
      
      // Call the parent's onDelete function if provided
      if (effectiveOnDelete) {
        effectiveOnDelete(fileToDelete.id);
      }
      
      toast({
        title: t("common.success"),
        description: t("File deleted successfully"),
      });
      
    } catch (error) {
      console.error('Error handling file deletion:', error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("common.errorDeletingFile"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleDownload = async (fileToDownload: FileRecord) => {
    if (!fileToDownload.file_path) {
      toast({
        title: t("common.error"),
        description: t("File path is missing"),
        variant: "destructive",
      });
      return;
    }
    
    try {
      const bucket = getBucketName();
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(fileToDownload.file_path);
        
      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error("File not found");
      }
      
      // Create a download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileToDownload.filename || "download";
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      toast({
        title: t("common.success"),
        description: t("File downloaded successfully"),
      });
      
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("common.errorDownloadingFile"),
        variant: "destructive",
      });
    }
  };
  
  // Function to get file type icon based on content type
  const getFileIcon = () => {
    return <FileText className="mr-2 h-4 w-4" />;
  };

  // If we have a files array, render multiple files
  if (files && files.length > 0) {
    return (
      <div className="space-y-1">
        {files.map((fileItem) => (
          <div key={fileItem.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
            <div className="flex items-center overflow-hidden">
              {getFileIcon()}
              <span className="text-sm truncate" title={fileItem.filename}>
                {fileItem.filename || "Unnamed file"}
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => handleDownload(fileItem)}
                title={t("common.download")}
              >
                <Download className="h-4 w-4" />
              </Button>
              
              {effectiveShowDelete && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => handleDelete(fileItem)}
                  disabled={isDeleting}
                  title={t("common.delete")}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // Fall back to single file display if files array isn't provided but a single file is
  if (file) {
    return (
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md my-1">
        <div className="flex items-center overflow-hidden">
          {getFileIcon()}
          <span className="text-sm truncate" title={file.filename}>
            {file.filename || "Unnamed file"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => handleDownload(file)}
            title={t("common.download")}
          >
            <Download className="h-4 w-4" />
          </Button>
          
          {effectiveShowDelete && (
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => handleDelete(file)}
              disabled={isDeleting}
              title={t("common.delete")}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      </div>
    );
  }
  
  // If no files, return null or an empty state message
  return <div className="text-sm text-muted-foreground">{t("common.noFiles")}</div>;
};
