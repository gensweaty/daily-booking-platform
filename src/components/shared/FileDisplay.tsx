
import { FileRecord } from "@/types/files";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Download } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface FileDisplayProps {
  file: FileRecord;
  onDelete?: (id: string) => void;
  showDelete?: boolean;
  parentType?: string;
}

export const FileDisplay = ({
  file,
  onDelete,
  showDelete = true,
  parentType = 'event'
}: FileDisplayProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  
  // Get the appropriate bucket name based on the file source or parent type
  const getBucketName = () => {
    // Always default to event_attachments for now as our main storage bucket
    return 'event_attachments';
  };
  
  const handleDelete = async () => {
    if (!file.id) return;
    
    try {
      setIsDeleting(true);
      
      // Step 1: Delete the file from storage if it has a path
      if (file.file_path) {
        const bucket = getBucketName();
        console.log(`Attempting to delete file from ${bucket}/${file.file_path}`);
        
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([file.file_path]);
          
        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
          // Continue even if storage delete fails - we still want to remove the record
        }
      }
      
      // Step 2: Delete the file record from the database
      let error;
      
      // Determine which table to delete from based on parentType
      if (file.source === 'event_files' || parentType === 'event') {
        const { error: dbError } = await supabase
          .from('event_files')
          .delete()
          .eq('id', file.id);
          
        error = dbError;
      } else if (parentType === 'customer' || file.customer_id) {
        const { error: dbError } = await supabase
          .from('customer_files_new')
          .delete()
          .eq('id', file.id);
          
        error = dbError;
      }
      
      if (error) {
        console.error('Error deleting file record:', error);
        throw error;
      }
      
      // Call the parent's onDelete function if provided
      if (onDelete) {
        onDelete(file.id);
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
  
  const handleDownload = async () => {
    if (!file.file_path) {
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
        .download(file.file_path);
        
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
      a.download = file.filename || "download";
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
          onClick={handleDownload}
          title={t("common.download")}
        >
          <Download className="h-4 w-4" />
        </Button>
        
        {showDelete && (
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleDelete}
            disabled={isDeleting}
            title={t("common.delete")}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        )}
      </div>
    </div>
  );
};
