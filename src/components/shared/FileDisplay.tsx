import { Button } from "@/components/ui/button";
import { supabase, normalizeFilePath } from "@/integrations/supabase/client";
import { determineEffectiveBucket, getDirectFileUrl } from "@/integrations/supabase/utils";
import { Download, Trash2, FileIcon, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface FileDisplayProps {
  files: any[];
  bucketName: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentId?: string;
  parentType?: string;
}

export const FileDisplay = ({ 
  files, 
  bucketName, 
  allowDelete = false, 
  onFileDeleted,
  parentId,
  parentType
}: FileDisplayProps) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [fileURLs, setFileURLs] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  useEffect(() => {
    const newURLs: {[key: string]: string} = {};
    files.forEach(file => {
      if (file.file_path) {
        // Special handling for fully qualified URLs (public links)
        if (file.file_path.startsWith('http://') || file.file_path.startsWith('https://')) {
          // For public URLs, just use the URL directly
          newURLs[file.id] = file.file_path;
          console.log(`File ${file.filename}: Using public URL ${file.file_path}`);
          return;
        }
        
        const normalizedPath = normalizeFilePath(file.file_path);
        const effectiveBucket = determineEffectiveBucket(file.file_path, parentType, file.source);
        console.log(`File ${file.filename}: Using bucket ${effectiveBucket} for path ${file.file_path}`);
        newURLs[file.id] = `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizedPath}`;
      }
    });
    setFileURLs(newURLs);
  }, [files, parentType]);

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };
  
  const isImage = (filename: string): boolean => {
    const ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  };

  const getFileIcon = (filename: string) => {
    return <FileIcon className="h-5 w-5" />;
  };

  const handleDownload = async (filePath: string, fileName: string, fileId: string) => {
    try {
      console.log(`Attempting to download file: ${fileName}, path: ${filePath}`);
      
      // Special handling for fully qualified URLs (public links)
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        // For public URLs, open in new tab instead of downloading
        window.open(filePath, '_blank', 'noopener,noreferrer');
        return;
      }
      
      const effectiveBucket = determineEffectiveBucket(filePath, parentType);
      console.log(`Download: Using bucket ${effectiveBucket} for path ${filePath}`);
      
      const directUrl = fileURLs[fileId] || 
        `${getStorageUrl()}/object/public/${effectiveBucket}/${normalizeFilePath(filePath)}`;
      
      console.log('Using direct URL for download:', directUrl);
      
      // Force download using fetch to get the blob
      const response = await fetch(directUrl);
      const blob = await response.blob();
      
      // Create blob URL and handle download
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create a hidden anchor element for download
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName; // Set download attribute
      a.style.display = 'none'; // Hide the element
      
      // Add to DOM, trigger click, and clean up
      document.body.appendChild(a);
      a.click();
      
      // Remove element and revoke blob URL after a delay
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl); // Important: free up memory
      }, 100);
      
      toast({
        title: t("common.success"),
        description: t("common.downloadStarted"),
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: t("common.error"),
        description: t("common.downloadError"),
        variant: "destructive",
      });
    }
  };

  const handleOpenFile = async (filePath: string, fileId: string) => {
    try {
      if (!filePath) {
        throw new Error('File path is missing');
      }
      
      const directUrl = getDirectFileUrl(filePath, fileId, parentType);
      console.log('Opening file with direct URL:', directUrl);
      
      // Open in a new tab to prevent navigating away
      window.open(directUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening file:', error);
      toast({
        title: t("common.error"),
        description: t("common.fileAccessError"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      setDeletingFileId(fileId);
      
      // Special handling for public links - we can't delete them
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        console.log("Cannot delete external file from storage:", filePath);
        
        // But we can delete the reference from our database
        const tableName = parentType === 'event' ? 'event_files' : 
                          parentType === 'customer' ? 'customer_files_new' : 'files';
        
        console.log(`Deleting file reference from table ${tableName}, id: ${fileId}`);
        const { error: dbError } = await supabase
          .from(tableName)
          .delete()
          .eq('id', fileId);
          
        if (dbError) {
          console.error(`Error deleting file from ${tableName}:`, dbError);
          throw dbError;
        }
        
        if (onFileDeleted) {
          onFileDeleted(fileId);
        }
        
        toast({
          title: t("common.success"),
          description: t("common.fileDeleted"),
        });
        
        return;
      }
      
      const effectiveBucket = determineEffectiveBucket(filePath, parentType);
      console.log(`Deleting file from bucket ${effectiveBucket}, path: ${filePath}`);
      
      // Skip storage delete if it's a booking file (just a reference)
      if (!fileId.startsWith('booking-')) {
        const { error: storageError } = await supabase.storage
          .from(effectiveBucket)
          .remove([normalizeFilePath(filePath)]);
  
        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
          // We continue even if we can't delete from storage
          // It may be a reference to a file in another record
        }
      }
      
      // Skip database delete for virtual booking files
      if (!fileId.startsWith('booking-')) {
        let tableName = 'files';
        if (effectiveBucket === 'event_attachments' || parentType === 'event') {
          tableName = 'event_files';
        } else if (effectiveBucket === 'customer_attachments' || parentType === 'customer') {
          tableName = 'customer_files_new';
        } else if (effectiveBucket === 'note_attachments' || parentType === 'note') {
          tableName = 'note_files';
        }
        
        console.log(`Deleting file record from table ${tableName}, id: ${fileId}`);
        const { error: dbError } = await supabase
          .from(tableName)
          .delete()
          .eq('id', fileId);
          
        if (dbError) {
          console.error(`Error deleting file from ${tableName}:`, dbError);
          throw dbError;
        }
      }
      
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
      });
    } catch (error) {
      console.error('Error deleting file:', error);
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
      <h3 className="text-sm font-medium">{t("common.attachments")}</h3>
      <div className="space-y-2">
        {files.map((file) => {
          if (!file.file_path) return null;
          
          const fileNameDisplay = file.filename && file.filename.length > 20 
            ? file.filename.substring(0, 20) + '...' 
            : file.filename;
          
          // Special handling for public URLs
          const isPublicUrl = file.file_path.startsWith('http://') || file.file_path.startsWith('https://');
          const imageUrl = isPublicUrl ? file.file_path : (
            fileURLs[file.id] || 
            `${getStorageUrl()}/object/public/${determineEffectiveBucket(file.file_path, parentType, file.source)}/${normalizeFilePath(file.file_path)}`
          );
            
          return (
            <div key={file.id} className="flex flex-col bg-background border rounded-md overflow-hidden">
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  {isImage(file.filename) ? (
                    <div className="h-8 w-8 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                      <img 
                        src={imageUrl}
                        alt={file.filename}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          console.error('Image failed to load', e, 'URL:', imageUrl);
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
                    onClick={() => handleDownload(file.file_path, file.filename, file.id)}
                    title={t("common.download")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {allowDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(file.id, file.file_path)}
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
                onClick={() => handleOpenFile(file.file_path, file.id)}
              >
                <ExternalLink className="h-4 w-4" />
                {t("crm.open")}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
