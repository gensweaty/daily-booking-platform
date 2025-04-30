
import { FileRecord } from "@/types/files";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Download, ExternalLink, Image as ImageIcon, FileIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "./LanguageText";

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
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [fileUrls, setFileUrls] = useState<Record<string, string | null>>({});
  const { toast } = useToast();
  const { t } = useLanguage();
  
  // Add debug logging on mount
  useEffect(() => {
    console.log("FileDisplay - Mounted with files:", files);
    console.log("FileDisplay - Mounted with file:", file);
    console.log("FileDisplay - Parent type:", parentType);
    console.log("FileDisplay - Bucket name:", bucketName);
  }, [files, file, parentType, bucketName]);
  
  // Support both legacy and new properties
  const effectiveShowDelete = showDelete || allowDelete;
  const effectiveOnDelete = onDelete || onFileDeleted;
  
  // Get the appropriate bucket name based on the file source or parent type
  const getBucketName = (fileItem?: FileRecord) => {
    // If bucketName is provided directly, use that
    if (bucketName) return bucketName;
    
    // If file has source info, use that to determine bucket
    if (fileItem?.source) {
      if (fileItem.source.includes('booking') || fileItem.source.includes('event')) {
        return 'event_attachments';
      } else if (fileItem.source.includes('customer')) {
        return 'customer_attachments';
      } else if (fileItem.source.includes('note')) {
        return 'note_attachments';
      } else if (fileItem.source.includes('task')) {
        return 'task_attachments';
      }
    }
    
    // Otherwise determine from parentType
    switch (parentType) {
      case 'task':
        return 'task_attachments';
      case 'note':
        return 'note_attachments';
      case 'customer':
        return 'customer_attachments';
      case 'event':
      case 'booking_request':
      default:
        return 'event_attachments';
    }
  };
  
  // Check if the file is an image that can be previewed
  const isImage = (fileItem: FileRecord) => {
    const contentType = fileItem.content_type?.toLowerCase() || '';
    return contentType.startsWith('image/');
  };
  
  // Preload all file URLs on component mount
  useEffect(() => {
    const allFiles = files || (file ? [file] : []);
    const loadUrls = async () => {
      const urls: Record<string, string | null> = {};
      
      for (const fileItem of allFiles) {
        if (!fileItem?.file_path) continue;
        
        try {
          const bucket = getBucketName(fileItem);
          console.log(`Getting URL for ${fileItem.filename} from bucket ${bucket}`);
          
          const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileItem.file_path);
            
          const fileId = fileItem.id || `file-${Math.random().toString(36).substring(7)}`;
          urls[fileId] = data.publicUrl;
          
          console.log(`File URL for ${fileItem.filename} (${fileId}):`, data.publicUrl);
        } catch (error) {
          console.error(`Error getting URL for file ${fileItem.filename}:`, error);
        }
      }
      
      setFileUrls(urls);
    };
    
    loadUrls();
  }, [files, file]);
  
  // Get public URL for a file
  const getFileUrl = (fileItem: FileRecord) => {
    if (!fileItem?.file_path) return null;
    
    const fileId = fileItem.id || `file-${Math.random().toString(36).substring(7)}`;
    
    // If we already loaded the URL, use the cached version
    if (fileUrls[fileId]) return fileUrls[fileId];
    
    // Otherwise get it from storage
    try {
      const bucket = getBucketName(fileItem);
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileItem.file_path);
      
      // Cache the URL
      setFileUrls(prev => ({
        ...prev,
        [fileId]: data.publicUrl
      }));
      
      return data.publicUrl;
    } catch (error) {
      console.error(`Error getting URL for file ${fileItem.filename}:`, error);
      return null;
    }
  };
  
  const handleImageLoad = (fileId: string) => {
    setLoadedImages(prev => ({
      ...prev,
      [fileId]: true
    }));
    console.log(`Image loaded successfully for ${fileId}`);
  };
  
  const handleImageError = (fileId: string) => {
    console.error(`Failed to load image for file ID: ${fileId}`);
    setLoadedImages(prev => ({
      ...prev,
      [fileId]: false
    }));
  };
  
  const handleDelete = async (fileToDelete: FileRecord) => {
    if (!fileToDelete.id) return;
    
    try {
      setIsDeleting(true);
      console.log("Deleting file:", fileToDelete);
      
      // Step 1: Delete the file from storage if it has a path
      if (fileToDelete.file_path) {
        const bucket = getBucketName(fileToDelete);
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
      
      // Determine which table to delete from based on parentType or file source
      console.log("Deleting from table based on parentType:", parentType);
      console.log("File source:", fileToDelete.source);
      
      if (fileToDelete.source === 'event_files' || parentType === 'event') {
        console.log("Deleting from event_files table");
        const { error: dbError } = await supabase
          .from('event_files')
          .delete()
          .eq('id', fileToDelete.id);
          
        error = dbError;
      } else if (fileToDelete.source?.includes('booking_request') || fileToDelete.booking_request_id || parentType === 'booking_request') {
        console.log("Deleting from booking_files table");
        const { error: dbError } = await supabase
          .from('booking_files')
          .delete()
          .eq('id', fileToDelete.id);
          
        error = dbError;
      } else if (parentType === 'customer' || fileToDelete.customer_id) {
        console.log("Deleting from customer_files_new table");
        const { error: dbError } = await supabase
          .from('customer_files_new')
          .delete()
          .eq('id', fileToDelete.id);
          
        error = dbError;
      } else if (parentType === 'note') {
        console.log("Deleting from note_files table");
        const { error: dbError } = await supabase
          .from('note_files')
          .delete()
          .eq('id', fileToDelete.id);
          
        error = dbError;
      } else if (parentType === 'task') {
        console.log("Deleting from files table");
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
        console.log("Calling onFileDeleted callback");
        effectiveOnDelete(fileToDelete.id);
      }
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
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
        description: t("common.fileMissing"),
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log("Downloading file:", fileToDownload);
      const bucket = getBucketName(fileToDownload);
      console.log(`Downloading from bucket: ${bucket}, path: ${fileToDownload.file_path}`);
      
      // First try using the Supabase storage API
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(fileToDownload.file_path);
        
      if (error) {
        console.error("Download error:", error);
        
        // Fallback to direct URL download if the API fails
        const fileUrl = getFileUrl(fileToDownload);
        if (fileUrl) {
          const a = document.createElement("a");
          a.href = fileUrl;
          a.download = fileToDownload.filename || "download";
          document.body.appendChild(a);
          a.click();
          
          setTimeout(() => {
            document.body.removeChild(a);
          }, 100);
          
          toast({
            title: t("common.success"),
            description: t("common.fileDownloadStarted"),
          });
          
          return;
        }
        
        throw error;
      }
      
      if (!data) {
        console.error("No file data returned");
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
        description: t("common.fileDownloaded"),
      });
      
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("common.errorDownloadingFile"),
        variant: "destructive",
      });
      
      // Last resort fallback - try opening the file directly
      try {
        const fileUrl = getFileUrl(fileToDownload);
        if (fileUrl) {
          window.open(fileUrl, '_blank');
        }
      } catch (e) {
        console.error('Even fallback failed:', e);
      }
    }
  };
  
  // Function to open file in a new tab
  const handleOpenFile = (fileToOpen: FileRecord) => {
    const fileUrl = getFileUrl(fileToOpen);
    console.log("Opening file with URL:", fileUrl);
    
    if (fileUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: t("common.error"),
        description: t("common.unableToOpenFile"),
        variant: "destructive",
      });
    }
  };
  
  // Function to get file type icon based on content type
  const getFileIcon = (fileItem: FileRecord) => {
    const contentType = fileItem.content_type?.toLowerCase() || '';
    
    if (contentType.startsWith('image/')) {
      return <ImageIcon className="mr-2 h-4 w-4" />;
    }
    
    return <FileIcon className="mr-2 h-4 w-4" />;
  };

  // Render file thumbnail for images
  const renderThumbnail = (fileItem: FileRecord) => {
    if (isImage(fileItem)) {
      const fileUrl = getFileUrl(fileItem);
      const fileId = fileItem.id || `file-${Math.random().toString(36).substring(7)}`;
      
      if (fileUrl) {
        return (
          <div className="h-8 w-8 rounded overflow-hidden mr-2 flex-shrink-0 bg-muted flex items-center justify-center">
            <img 
              src={fileUrl} 
              alt={fileItem.filename} 
              className="h-full w-full object-cover cursor-pointer"
              onClick={() => handleOpenFile(fileItem)}
              onLoad={() => handleImageLoad(fileId)}
              onError={() => handleImageError(fileId)}
              style={{ display: loadedImages[fileId] === false ? 'none' : 'block' }}
            />
            {loadedImages[fileId] === false && getFileIcon(fileItem)}
          </div>
        );
      }
    }
    
    return (
      <div className="h-8 w-8 rounded overflow-hidden mr-2 flex-shrink-0 bg-muted flex items-center justify-center">
        {getFileIcon(fileItem)}
      </div>
    );
  };

  // If we have a files array, render multiple files
  if (files && files.length > 0) {
    return (
      <div className="space-y-1">
        {files.map((fileItem) => (
          <div key={fileItem.id || `file-${Math.random().toString(36).substring(7)}`} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
            <div className="flex items-center overflow-hidden cursor-pointer" onClick={() => handleOpenFile(fileItem)}>
              {renderThumbnail(fileItem)}
              <span className="text-sm truncate hover:underline" title={fileItem.filename}>
                {fileItem.filename || "Unnamed file"}
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => handleOpenFile(fileItem)}
                title={t("common.open")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              
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
        <div className="flex items-center overflow-hidden cursor-pointer" onClick={() => handleOpenFile(file)}>
          {renderThumbnail(file)}
          <span className="text-sm truncate hover:underline" title={file.filename}>
            {file.filename || "Unnamed file"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => handleOpenFile(file)}
            title={t("common.open")}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        
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
  
  // If no files, return a message
  return <div className="text-sm text-muted-foreground"><LanguageText>{t("common.noFiles")}</LanguageText></div>;
};
