
import { Button } from "@/components/ui/button";
import { 
  supabase, 
  getStorageUrl, 
  normalizeFilePath, 
  STORAGE_BUCKETS, 
  getFileUrl 
} from "@/integrations/supabase/client";
import { Download, Trash2, FileIcon, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FileRecord } from "@/types/files";

interface FileDisplayProps {
  files: FileRecord[];
  bucketName?: string;  // This is now optional and only used as fallback
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

  // Better debugging for files data to identify issues
  useEffect(() => {
    if (files && files.length > 0) {
      console.log("Files data in FileDisplay:", files);
      
      // Log paths for each file for debugging
      files.forEach(file => {
        if (file.file_path) {
          console.log(`File ${file.filename}: Path=${file.file_path}`);
        } else {
          console.error(`File ${file.filename || 'unknown'} has no file_path`);
        }
      });
    } else {
      console.log("No files provided to FileDisplay component");
    }
  }, [files]);

  // Remove duplicate files based on file_path to prevent showing the same file twice
  const uniqueFiles = files.reduce((acc: FileRecord[], current) => {
    const isDuplicate = acc.some(item => item.file_path === current.file_path);
    if (!isDuplicate) {
      acc.push(current);
    }
    return acc;
  }, []);

  useEffect(() => {
    const newURLs: {[key: string]: string} = {};
    uniqueFiles.forEach(file => {
      if (file.file_path) {
        // Use the getFileUrl helper to ensure consistent URL generation
        newURLs[file.id] = getFileUrl(file.file_path);
      }
    });
    setFileURLs(newURLs);
  }, [uniqueFiles]);

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
      
      // Always use consistent file URL approach
      const directUrl = fileURLs[fileId] || getFileUrl(filePath);
      
      console.log('Using direct URL for download:', directUrl);
      
      // Force download using fetch to get the blob
      const response = await fetch(directUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }
      
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
      
      const directUrl = fileURLs[fileId] || getFileUrl(filePath);
      console.log('Opening file with direct URL:', directUrl);
      
      // Open in a new tab
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
      
      // Always use EVENT_ATTACHMENTS bucket for storage operations
      console.log(`Deleting file from bucket ${STORAGE_BUCKETS.EVENT}, path: ${filePath}`);
      
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKETS.EVENT)
        .remove([normalizeFilePath(filePath)]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        throw storageError;
      }
      
      // Determine the appropriate table name based on the parent type
      let tableName: "event_files" | "customer_files_new" | "note_files" | "files" = "event_files";
      
      if (parentType === 'customer') {
        tableName = "customer_files_new";
      } else if (parentType === 'note') {
        tableName = "note_files";
      } else if (parentType === 'task') {
        tableName = "files";  // Task files are stored in the "files" table
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
      
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      // Make sure to invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
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

  if (!uniqueFiles || uniqueFiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* We already have the heading in some places, so let's not duplicate it */}
      <div className="space-y-2">
        {uniqueFiles.map((file) => {
          if (!file.file_path) {
            console.warn(`File ${file.id} has no file_path, skipping render`);
            return null;
          }
          
          const fileNameDisplay = file.filename && file.filename.length > 20 
            ? file.filename.substring(0, 20) + '...' 
            : file.filename;
          
          // Get consistent image URL
          const imageUrl = fileURLs[file.id] || getFileUrl(file.file_path);
            
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
                    title={t("common.download") || "Download"}
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
                      title={t("common.delete") || "Delete"}
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
                {t("crm.open") || "Open"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
